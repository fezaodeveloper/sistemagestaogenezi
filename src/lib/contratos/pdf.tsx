import "server-only";

import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCpf, formatTelefone, isMinor } from "@/lib/alunos/schema";
import { TURNO_LABELS, type Turno } from "@/lib/turmas/schema";
import { FORMA_PAGAMENTO_LABELS, type FormaPagamento } from "@/lib/matriculas/schema";
import { tiptapJsonParaRuns, type TextoRun } from "@/lib/certificados/texto";
import type { ContratoTemplate } from "./schema";

// Tamanho de corpo de contrato (documento comum) — bem menor que
// TAMANHO_FONTE_PADRAO de certificados/texto.ts (22px, pensado pra um
// certificado decorativo de página inteira), usado só quando nenhum
// tamanho de fonte é aplicado explicitamente no editor do template.
const CONTRATO_TAMANHO_FONTE_PADRAO = 11;

const pdfStyles = StyleSheet.create({
  page: { padding: 48, fontSize: CONTRATO_TAMANHO_FONTE_PADRAO, fontFamily: "Helvetica", lineHeight: 1.5 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 10,
  },
  logo: { width: 40, height: 40, objectFit: "contain" },
  nomeEscola: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  numeroContrato: { fontSize: 9, textAlign: "center", color: "#555555", marginBottom: 20 },
  paragrafo: { marginBottom: 8, textAlign: "justify" },
  assinaturas: { marginTop: 48, flexDirection: "row", justifyContent: "space-between" },
  assinatura: { width: "45%", textAlign: "center", borderTopWidth: 1, borderTopColor: "#000000", paddingTop: 4, fontSize: 9 },
  footer: { marginTop: 24, fontSize: 8, textAlign: "center", color: "#555555" },
});

// tiptapJsonParaRuns marca quebra de parágrafo com um run "\n" isolado
// (ver comentário na própria função, em certificados/texto.ts) — reagrupa
// isso em parágrafos de verdade pra desenhar um <Text> por parágrafo.
function agruparEmParagrafos(runs: TextoRun[]): TextoRun[][] {
  const paragrafos: TextoRun[][] = [[]];
  for (const run of runs) {
    if (run.texto === "\n") {
      paragrafos.push([]);
      continue;
    }
    paragrafos[paragrafos.length - 1].push(run);
  }
  return paragrafos.filter((paragrafo) => paragrafo.length > 0);
}

function ContratoPdfDocument({
  template,
  variaveis,
  numeroContrato,
  nomeEscola,
  logoUrl,
  geradoEm,
}: {
  template: ContratoTemplate;
  variaveis: Record<string, string>;
  numeroContrato: string;
  nomeEscola: string;
  logoUrl: string | null;
  geradoEm: string;
}) {
  const paragrafos = agruparEmParagrafos(tiptapJsonParaRuns(template.conteudo, variaveis));

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> aqui é o componente do @react-pdf/renderer, não um <img> HTML */}
          {logoUrl && <Image src={logoUrl} style={pdfStyles.logo} />}
          <Text style={pdfStyles.nomeEscola}>{nomeEscola}</Text>
        </View>

        <Text style={pdfStyles.titulo}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS</Text>
        <Text style={pdfStyles.numeroContrato}>Contrato nº {numeroContrato}</Text>

        {paragrafos.map((paragrafo, indice) => (
          <Text key={indice} style={pdfStyles.paragrafo}>
            {paragrafo.map((run, indiceRun) => (
              <Text
                key={indiceRun}
                style={{
                  fontFamily: run.negrito ? "Helvetica-Bold" : "Helvetica",
                  textDecoration: run.sublinhado ? "underline" : undefined,
                  fontSize: run.tamanhoFonte ?? CONTRATO_TAMANHO_FONTE_PADRAO,
                  color: template.cor_texto,
                }}
              >
                {run.texto}
              </Text>
            ))}
          </Text>
        ))}

        <View style={pdfStyles.assinaturas}>
          <Text style={pdfStyles.assinatura}>Escola</Text>
          <Text style={pdfStyles.assinatura}>Aluno/Responsável</Text>
        </View>

        <Text style={pdfStyles.footer}>Este contrato foi gerado eletronicamente em {geradoEm}.</Text>
      </Page>
    </Document>
  );
}

function formatValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC).
function formatDataBR(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

type MatriculaParaContrato = {
  id: string;
  aluno_id: string;
  valor_final: number | null;
  num_parcelas: number | null;
  valor_parcela: number | null;
  forma_pagamento: FormaPagamento | null;
  data_primeira_mensalidade: string | null;
  data_inicio: string | null;
  previsao_conclusao: string | null;
  alunos: {
    cpf: string;
    telefone: string;
    email: string;
    data_nascimento: string;
    profiles: { full_name: string | null } | null;
  } | null;
  turmas: {
    nome: string;
    turno: Turno | null;
    cursos: { nome: string; carga_horaria_horas: number | null } | null;
  } | null;
};

// Único caminho de geração do PDF do contrato — busca todos os dados
// (matrícula, aluno, responsável se menor, curso/turma, template,
// configurações da escola) e monta o documento com @react-pdf/renderer.
// Roda com o client admin (service_role), mesmo padrão de
// certificados/emitir.ts: quem decidiu que a matrícula existe e é válida
// já foi o código que criou a matrícula (ver createMatricula), este código
// só monta o PDF com dados já gravados no banco.
export async function gerarContratoPdf(matriculaId: string): Promise<Buffer> {
  const admin = createAdminClient();

  const { data: matriculaData, error } = await admin
    .from("matriculas")
    .select(
      "id, aluno_id, valor_final, num_parcelas, valor_parcela, forma_pagamento, data_primeira_mensalidade, data_inicio, previsao_conclusao, alunos(cpf, telefone, email, data_nascimento, profiles!alunos_id_fkey(full_name)), turmas(nome, turno, cursos(nome, carga_horaria_horas))",
    )
    .eq("id", matriculaId)
    .single();

  if (error || !matriculaData) {
    throw new Error("Matrícula não encontrada para gerar o contrato.");
  }
  const matricula = matriculaData as unknown as MatriculaParaContrato;

  let responsavel: { nome: string; cpf: string } | null = null;
  if (matricula.alunos?.data_nascimento && isMinor(matricula.alunos.data_nascimento)) {
    const { data: resp } = await admin
      .from("responsaveis")
      .select("nome, cpf")
      .eq("aluno_id", matricula.aluno_id)
      .maybeSingle();
    responsavel = resp ?? null;
  }

  const { data: templateData } = await admin.from("contrato_template").select("*").maybeSingle();
  if (!templateData) {
    throw new Error("Template de contrato não configurado.");
  }
  const template = templateData as ContratoTemplate;

  const { data: configuracoes } = await admin
    .from("configuracoes")
    .select("escola_nome, escola_logo_url")
    .eq("id", true)
    .single();

  const nomeEscola = configuracoes?.escola_nome ?? "GÊNEZI Educação Profissional";

  const variaveis: Record<string, string> = {
    nome_aluno: matricula.alunos?.profiles?.full_name ?? "—",
    cpf_aluno: matricula.alunos?.cpf ? formatCpf(matricula.alunos.cpf) : "—",
    email_aluno: matricula.alunos?.email ?? "—",
    telefone_aluno: matricula.alunos?.telefone ? formatTelefone(matricula.alunos.telefone) : "—",
    nome_responsavel: responsavel?.nome ?? "",
    cpf_responsavel: responsavel?.cpf ? formatCpf(responsavel.cpf) : "",
    nome_curso: matricula.turmas?.cursos?.nome ?? "—",
    nome_turma: matricula.turmas?.nome ?? "—",
    turno: matricula.turmas?.turno ? TURNO_LABELS[matricula.turmas.turno] : "—",
    carga_horaria: matricula.turmas?.cursos?.carga_horaria_horas
      ? `${matricula.turmas.cursos.carga_horaria_horas} horas`
      : "—",
    data_inicio: formatDataBR(matricula.data_inicio),
    previsao_conclusao: formatDataBR(matricula.previsao_conclusao),
    valor_total: formatValor(matricula.valor_final),
    num_parcelas: matricula.num_parcelas ? String(matricula.num_parcelas) : "—",
    valor_parcela: formatValor(matricula.valor_parcela),
    data_primeira_mensalidade: formatDataBR(matricula.data_primeira_mensalidade),
    forma_pagamento: matricula.forma_pagamento ? FORMA_PAGAMENTO_LABELS[matricula.forma_pagamento] : "—",
    data_contrato: formatDataBR(new Date().toISOString().slice(0, 10)),
    nome_escola: nomeEscola,
  };

  const numeroContrato = matriculaId.slice(0, 8).toUpperCase();
  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return renderToBuffer(
    <ContratoPdfDocument
      template={template}
      variaveis={variaveis}
      numeroContrato={numeroContrato}
      nomeEscola={nomeEscola}
      logoUrl={configuracoes?.escola_logo_url ?? null}
      geradoEm={geradoEm}
    />,
  );
}
