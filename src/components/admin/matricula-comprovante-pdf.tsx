import { Circle, Document, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatCpf, formatTelefone } from "@/lib/alunos/schema";
import { LogoEscolaPdf } from "@/components/pdf/logo-escola-pdf";
import { CURSO_TIPO_LABELS, type CURSO_TIPOS } from "@/lib/cursos/schema";
import { DIA_SEMANA_LABELS, type DIAS_SEMANA } from "@/lib/turmas/schema";
import {
  DESCONTO_TIPO_LABELS,
  FORMA_PAGAMENTO_LABELS,
  TAXA_MATRICULA_FORMA_PAGAMENTO_LABELS,
  type DescontoFormato,
  type DescontoTipo,
  type FormaPagamento,
  type TaxaMatriculaFormaPagamento,
} from "@/lib/matriculas/schema";

// Tipos estruturais mínimos que o comprovante precisa — deliberadamente não
// importados de AlunoParaMatricula/CursoParaMatricula/TurmaParaMatricula
// (src/app/admin/matriculas/actions.ts), que carregam campos específicos do
// wizard (ex.: turmas de um curso, vagas) irrelevantes aqui. Isso deixa esse
// componente reutilizável tanto pelo wizard quanto pela tela de detalhes.
type ResumoAluno = { full_name: string | null; email: string; cpf: string; telefone: string };
type ResumoCurso = {
  nome: string;
  tipo: (typeof CURSO_TIPOS)[number];
  carga_horaria_horas: number | null;
  descricao?: string | null;
  totalModulos?: number;
  totalAulas?: number;
};
type ResumoTurma = {
  nome: string;
  cadencia_dias_semana: (typeof DIAS_SEMANA)[number][] | null;
  horario_aula: string | null;
};

export type ResumoMatricula = {
  aluno: ResumoAluno;
  curso: ResumoCurso;
  turma: ResumoTurma;
  valorOriginal: number | null;
  descontoTipo: DescontoTipo;
  descontoFormato: DescontoFormato | null;
  descontoValor: number;
  valorFinal: number | null;
  numParcelas: number;
  valorParcela: number | null;
  formaPagamento: FormaPagamento;
  dataPrimeiraMensalidade: string;
  dataInicio: string;
  previsaoConclusao: string | null;
  apostilaEntregue: boolean;
  fardaEntregue: boolean;
  kitEntregue: boolean;
  observacoes: string;
  taxaMatriculaFinal?: number | null;
  taxaMatriculaFormaPagamento?: TaxaMatriculaFormaPagamento | null;
  taxaMatriculaPaga?: boolean;
  // Dados da escola (configuracoes) — opcionais: quando ausentes, o header
  // cai no nome fixo "Gênezi Educação Profissional" já usado antes desses
  // campos existirem.
  escola_nome?: string;
  // Data URI do logo (configuracoes.escola_logo_url) — ver getLogoEscolaPdf. Sem logo: o
  // cabeçalho mostra um "G" estilizado em círculo azul no lugar (ver FALLBACK_LOGO abaixo).
  escola_logo_url?: string | null;
  escola_endereco?: string;
  escola_telefone?: string;
  escola_email?: string;
  // Curso gratuito BÔNUS da matrícula (matriculas.curso_bonus_id) — adicional ao curso
  // principal acima, nunca o substitui. Destacado em azul dentro da seção "Informações do
  // Curso" (ver renderização abaixo).
  cursoBonusNome?: string;
  // Preenchidos manualmente pelo admin no momento da impressão (Dialog "aluno
  // é menor de idade?"), não vêm de nenhuma tabela — ver handleImprimirComprovante
  // em matricula-detalhes.tsx/matricula-wizard.tsx.
  responsavelNome?: string;
  responsavelCpf?: string;
};

// Paleta do modelo aprovado pelo cliente — mesmas cores reaproveitadas no recibo de pagamento
// (src/components/pdf/parcela-recibo-pdf.tsx), cada arquivo com sua própria cópia (nenhum dos
// PDFs deste projeto compartilha StyleSheet entre si, mesmo padrão já usado antes).
const AZUL_ESCURO = "#1a3a6b";
const AZUL_MEDIO = "#2980d4";
const AZUL_CLARO = "#cfe0f5";
const LINHA_ALT = "#f0f4f8";

// configuracoes.escola_slogan não existe (confirmado em consulta ao banco) — texto fixo do
// modelo aprovado, sem nenhum jeito de configurar pelo admin ainda.
const SLOGAN_PADRAO = "QUALIFICAÇÃO HOJE, MAIS OPORTUNIDADES AMANHÃ";

function formatValor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatParcelas(numParcelas: number, valorParcela: number | null): string {
  if (valorParcela === null) return "—";
  return `${numParcelas}x de ${formatValor(valorParcela)}`;
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC).
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatDiasSemana(dias: (typeof DIAS_SEMANA)[number][] | null | undefined): string {
  if (!dias || dias.length === 0) return "—";
  return dias.map((dia) => DIA_SEMANA_LABELS[dia]).join(", ");
}

const pdfStyles = StyleSheet.create({
  page: { fontSize: 9, fontFamily: "Helvetica" },
  conteudo: { padding: 28 },
  header: { alignItems: "center", paddingTop: 6 },
  logoFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AZUL_ESCURO,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoFallbackTexto: { color: "#ffffff", fontSize: 18, fontFamily: "Helvetica-Bold" },
  escolaNome: { fontSize: 13, fontFamily: "Helvetica-Bold", color: AZUL_ESCURO, marginTop: 2 },
  slogan: { fontSize: 7, color: "#777777", marginTop: 2, letterSpacing: 0.5 },
  divisoria: { height: 2, backgroundColor: AZUL_ESCURO, marginTop: 10, marginBottom: 10 },
  tituloLinha: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  tituloPreto: { color: "#000000" },
  tituloAzul: { color: AZUL_MEDIO },
  subtitulo: { fontSize: 9, color: "#555555", marginTop: 2 },
  meta: { fontSize: 8, color: "#555555", marginTop: 3 },
  secaoHeader: {
    backgroundColor: AZUL_ESCURO,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 10,
  },
  secaoHeaderTexto: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  linha: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6 },
  linhaLabel: { width: "38%", color: "#555555" },
  linhaValor: { width: "62%", fontFamily: "Helvetica-Bold" },
  linhaBonus: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: AZUL_CLARO,
  },
  linhaBonusTexto: { fontFamily: "Helvetica-Bold", color: AZUL_ESCURO },
  observacoesTexto: { paddingHorizontal: 6, paddingVertical: 4 },
  footer: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: AZUL_ESCURO,
    alignItems: "center",
  },
  footerNome: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center" },
  footerResponsavel: { fontSize: 9, color: "#555555", marginTop: 2, textAlign: "center" },
  footerEscola: { fontSize: 9, fontFamily: "Helvetica-Bold", color: AZUL_ESCURO, marginTop: 8, textAlign: "center" },
  footerContato: { fontSize: 8, color: "#555555", marginTop: 2, textAlign: "center" },
});

function LinhaPdf({ label, value, indice }: { label: string; value: string; indice: number }) {
  return (
    <View style={[pdfStyles.linha, { backgroundColor: indice % 2 === 0 ? "#ffffff" : LINHA_ALT }]}>
      <Text style={pdfStyles.linhaLabel}>{label}</Text>
      <Text style={pdfStyles.linhaValor}>{value}</Text>
    </View>
  );
}

// Decoração geométrica dos cantos do modelo aprovado — triângulo diagonal maciço nos cantos
// superior-esquerdo/inferior-direito, grade de pontos no canto superior-direito. Tudo dentro da
// área da página (sem position absolute): cada um entra no fluxo normal do próprio canto onde é
// usado, simples e sem risco de sobrepor conteúdo em páginas mais longas.
function TrianguloCanto({ variante }: { variante: "superior-esquerdo" | "inferior-direito" }) {
  const pontos = variante === "superior-esquerdo" ? "0,0 70,0 0,55" : "70,0 70,55 0,55";
  return (
    <Svg width={70} height={55}>
      <Polygon points={pontos} fill={AZUL_ESCURO} />
    </Svg>
  );
}

function GradePontos() {
  const espacamento = 11;
  const pontos = [];
  for (let linha = 0; linha < 4; linha++) {
    for (let coluna = 0; coluna < 4; coluna++) {
      pontos.push(
        <Circle key={`${linha}-${coluna}`} cx={coluna * espacamento + 4} cy={linha * espacamento + 4} r={1.6} fill={AZUL_CLARO} />,
      );
    }
  }
  return <Svg width={48} height={48}>{pontos}</Svg>;
}

export function MatriculaComprovantePdf({
  resumo,
  geradoEm,
}: {
  resumo: ResumoMatricula;
  geradoEm: string;
}) {
  const descontoTexto =
    resumo.descontoTipo === "sem_bolsa"
      ? "Sem desconto"
      : `${DESCONTO_TIPO_LABELS[resumo.descontoTipo]}${
          resumo.descontoFormato === "porcentagem"
            ? ` (${resumo.descontoValor}%)`
            : resumo.descontoFormato === "reais"
              ? ` (${formatValor(resumo.descontoValor)})`
              : ""
        }`;

  const linhasCurso: { label: string; value: string }[] = [
    { label: "Curso", value: resumo.curso.nome },
    ...(resumo.curso.descricao ? [{ label: "Descrição", value: resumo.curso.descricao }] : []),
    { label: "Carga horária", value: resumo.curso.carga_horaria_horas ? `${resumo.curso.carga_horaria_horas}h` : "—" },
    ...(resumo.curso.totalModulos !== undefined && resumo.curso.totalAulas !== undefined
      ? [{ label: "Módulos e aulas", value: `${resumo.curso.totalModulos} módulo(s), ${resumo.curso.totalAulas} aula(s)` }]
      : []),
    { label: "Turma", value: resumo.turma.nome },
    { label: "Local", value: CURSO_TIPO_LABELS[resumo.curso.tipo] },
    { label: "Dias de aula", value: formatDiasSemana(resumo.turma.cadencia_dias_semana) },
    { label: "Horário", value: resumo.turma.horario_aula ?? "—" },
    { label: "Início", value: formatDataBR(resumo.dataInicio) },
    { label: "Previsão de conclusão", value: resumo.previsaoConclusao ? formatDataBR(resumo.previsaoConclusao) : "—" },
  ];

  const linhasFinanceiro: { label: string; value: string }[] = [
    { label: "Valor original", value: formatValor(resumo.valorOriginal) },
    { label: "Desconto", value: descontoTexto },
    { label: "Valor final", value: formatValor(resumo.valorFinal) },
    { label: "Parcelamento", value: formatParcelas(resumo.numParcelas, resumo.valorParcela) },
    { label: "Forma de pagamento", value: FORMA_PAGAMENTO_LABELS[resumo.formaPagamento] },
    { label: "1ª mensalidade", value: formatDataBR(resumo.dataPrimeiraMensalidade) },
  ];

  const materiaisEntregues: { label: string; value: string }[] = [
    ...(resumo.apostilaEntregue ? [{ label: "Apostila", value: "Sim" }] : []),
    ...(resumo.fardaEntregue ? [{ label: "Farda", value: "Sim" }] : []),
    ...(resumo.kitEntregue ? [{ label: "Kit", value: "Sim" }] : []),
  ];

  const temTaxaMatricula =
    resumo.taxaMatriculaFinal !== null && resumo.taxaMatriculaFinal !== undefined && resumo.taxaMatriculaFinal > 0;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TrianguloCanto variante="superior-esquerdo" />
          <GradePontos />
        </View>

        <View style={pdfStyles.conteudo}>
          <View style={pdfStyles.header}>
            {resumo.escola_logo_url ? (
              <LogoEscolaPdf logoUrl={resumo.escola_logo_url} />
            ) : (
              <View style={pdfStyles.logoFallback}>
                <Text style={pdfStyles.logoFallbackTexto}>G</Text>
              </View>
            )}
            <Text style={pdfStyles.escolaNome}>{resumo.escola_nome ?? "Gênezi Educação Profissional"}</Text>
            <Text style={pdfStyles.slogan}>{SLOGAN_PADRAO}</Text>
          </View>

          <View style={pdfStyles.divisoria} />

          <View>
            <Text style={pdfStyles.tituloLinha}>
              <Text style={pdfStyles.tituloPreto}>COMPROVANTE </Text>
              <Text style={pdfStyles.tituloAzul}>DE MATRÍCULA</Text>
            </Text>
            <Text style={pdfStyles.subtitulo}>Documento emitido pelo sistema acadêmico</Text>
            <Text style={pdfStyles.meta}>📅 Emitido em {geradoEm}</Text>
          </View>

          <View style={pdfStyles.secaoHeader}>
            <Text style={pdfStyles.secaoHeaderTexto}>👤 ALUNO</Text>
          </View>
          <LinhaPdf indice={0} label="Nome" value={resumo.aluno.full_name ?? "—"} />
          <LinhaPdf indice={1} label="E-mail" value={resumo.aluno.email} />
          <LinhaPdf indice={2} label="CPF" value={formatCpf(resumo.aluno.cpf)} />
          <LinhaPdf indice={3} label="Telefone" value={formatTelefone(resumo.aluno.telefone)} />

          <View style={pdfStyles.secaoHeader}>
            <Text style={pdfStyles.secaoHeaderTexto}>🎓 INFORMAÇÕES DO CURSO</Text>
          </View>
          {linhasCurso.map((linha, indice) => (
            <LinhaPdf key={linha.label} indice={indice} label={linha.label} value={linha.value} />
          ))}
          {resumo.cursoBonusNome && (
            <View style={pdfStyles.linhaBonus}>
              <Text style={[pdfStyles.linhaLabel, pdfStyles.linhaBonusTexto]}>🎁 Curso Bônus</Text>
              <Text style={[pdfStyles.linhaValor, pdfStyles.linhaBonusTexto]}>{resumo.cursoBonusNome}</Text>
            </View>
          )}

          <View style={pdfStyles.secaoHeader}>
            <Text style={pdfStyles.secaoHeaderTexto}>💰 FINANCEIRO</Text>
          </View>
          {linhasFinanceiro.map((linha, indice) => (
            <LinhaPdf key={linha.label} indice={indice} label={linha.label} value={linha.value} />
          ))}

          {temTaxaMatricula && (
            <>
              <View style={pdfStyles.secaoHeader}>
                <Text style={pdfStyles.secaoHeaderTexto}>💳 TAXA DE MATRÍCULA</Text>
              </View>
              <LinhaPdf
                indice={0}
                label="Taxa de Matrícula"
                value={`${formatValor(resumo.taxaMatriculaFinal ?? null)} (${resumo.taxaMatriculaPaga ? "Paga" : "Pendente"})`}
              />
              <LinhaPdf
                indice={1}
                label="Forma de pagamento"
                value={
                  resumo.taxaMatriculaFormaPagamento
                    ? TAXA_MATRICULA_FORMA_PAGAMENTO_LABELS[resumo.taxaMatriculaFormaPagamento]
                    : "—"
                }
              />
            </>
          )}

          {materiaisEntregues.length > 0 && (
            <>
              <View style={pdfStyles.secaoHeader}>
                <Text style={pdfStyles.secaoHeaderTexto}>📦 MATERIAIS ENTREGUES</Text>
              </View>
              {materiaisEntregues.map((linha, indice) => (
                <LinhaPdf key={linha.label} indice={indice} label={linha.label} value={linha.value} />
              ))}
            </>
          )}

          {resumo.observacoes && (
            <>
              <View style={pdfStyles.secaoHeader}>
                <Text style={pdfStyles.secaoHeaderTexto}>📝 OBSERVAÇÕES</Text>
              </View>
              <Text style={pdfStyles.observacoesTexto}>{resumo.observacoes}</Text>
            </>
          )}

          <View style={pdfStyles.footer}>
            <Text style={pdfStyles.footerNome}>{resumo.aluno.full_name ?? "—"}</Text>
            {resumo.responsavelNome && (
              <Text style={pdfStyles.footerResponsavel}>Responsável: {resumo.responsavelNome}</Text>
            )}
            <Text style={pdfStyles.footerEscola}>{resumo.escola_nome ?? "Gênezi Educação Profissional"}</Text>
            {(resumo.escola_endereco || resumo.escola_telefone || resumo.escola_email) && (
              <Text style={pdfStyles.footerContato}>
                {[
                  resumo.escola_endereco ? `📍 ${resumo.escola_endereco}` : null,
                  resumo.escola_telefone ? `📞 ${resumo.escola_telefone}` : null,
                  resumo.escola_email ? `✉️ ${resumo.escola_email}` : null,
                ]
                  .filter(Boolean)
                  .join("   ")}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: -28 }}>
            <TrianguloCanto variante="inferior-direito" />
          </View>
        </View>
      </Page>
    </Document>
  );
}
