import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
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
  // cai no nome fixo "GÊNEZI — Educação Profissional" já usado antes desses
  // campos existirem, e o Termo de Imagem simplesmente não é impresso.
  escola_nome?: string;
  // Data URI do logo (configuracoes.escola_logo_url) — ver getLogoEscolaPdf.
  escola_logo_url?: string | null;
  escola_endereco?: string;
  escola_telefone?: string;
  termo_imagem_texto?: string;
  // Preenchidos manualmente pelo admin no momento da impressão (Dialog "aluno
  // é menor de idade?"), não vêm de nenhuma tabela — ver handleImprimirComprovante
  // em matricula-detalhes.tsx/matricula-wizard.tsx.
  responsavelNome?: string;
  responsavelCpf?: string;
};

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
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  header: { marginBottom: 12, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 8 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
    padding: 3,
  },
  row: { flexDirection: "row", marginBottom: 1 },
  label: { width: "40%", color: "#555555" },
  value: { width: "60%", fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 12, fontSize: 9, textAlign: "center", color: "#555555" },
  escolaContato: { fontSize: 9, color: "#555555", marginTop: 2 },
  // fontSize 8 (menor que o resto do PDF, 9): o texto do termo é
  // configurável pelo admin (configuracoes.termo_imagem_texto) e pode ficar
  // longo — reduzido de propósito pra não ser o parágrafo que empurra o
  // documento pra uma segunda página.
  termoTexto: { textAlign: "justify", marginBottom: 8, lineHeight: 1.35, fontSize: 8 },
  termoData: { marginBottom: 12 },
  // Mesmo padrão de linha de assinatura já usado no contrato
  // (src/lib/contratos/pdf.tsx: assinaturaLinha) — borda em vez de
  // caracteres "_____" literais, que não alinham bem em fontes PDF.
  assinaturaBloco: { marginTop: 8, width: "70%" },
  assinaturaLinha: { borderTopWidth: 1, borderTopColor: "#000000", marginBottom: 4 },
  assinaturaLabel: { fontSize: 9, color: "#555555" },
});

function LinhaPdf({ label, value }: { label: string; value: string }) {
  return (
    <View style={pdfStyles.row}>
      <Text style={pdfStyles.label}>{label}</Text>
      <Text style={pdfStyles.value}>{value}</Text>
    </View>
  );
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

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <LogoEscolaPdf logoUrl={resumo.escola_logo_url} />
          <Text style={pdfStyles.title}>{resumo.escola_nome ?? "GÊNEZI — Educação Profissional"}</Text>
          <Text style={pdfStyles.subtitle}>Comprovante de Matrícula</Text>
          {(resumo.escola_endereco || resumo.escola_telefone) && (
            <Text style={pdfStyles.escolaContato}>
              {[resumo.escola_endereco, resumo.escola_telefone].filter(Boolean).join(" · ")}
            </Text>
          )}
          <Text style={pdfStyles.meta}>Emitido em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Aluno</Text>
          <LinhaPdf label="Nome" value={resumo.aluno.full_name ?? "—"} />
          <LinhaPdf label="E-mail" value={resumo.aluno.email} />
          <LinhaPdf label="CPF" value={formatCpf(resumo.aluno.cpf)} />
          <LinhaPdf label="Telefone" value={formatTelefone(resumo.aluno.telefone)} />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Informações do Curso</Text>
          <LinhaPdf label="Curso" value={resumo.curso.nome} />
          {resumo.curso.descricao && <LinhaPdf label="Descrição" value={resumo.curso.descricao} />}
          <LinhaPdf
            label="Carga horária"
            value={resumo.curso.carga_horaria_horas ? `${resumo.curso.carga_horaria_horas}h` : "—"}
          />
          {resumo.curso.totalModulos !== undefined && resumo.curso.totalAulas !== undefined && (
            <LinhaPdf
              label="Módulos e aulas"
              value={`${resumo.curso.totalModulos} módulo(s), ${resumo.curso.totalAulas} aula(s)`}
            />
          )}
          <LinhaPdf label="Turma" value={resumo.turma.nome} />
          <LinhaPdf label="Local" value={CURSO_TIPO_LABELS[resumo.curso.tipo]} />
          <LinhaPdf label="Dias de aula" value={formatDiasSemana(resumo.turma.cadencia_dias_semana)} />
          <LinhaPdf label="Horário" value={resumo.turma.horario_aula ?? "—"} />
          <LinhaPdf label="Início" value={formatDataBR(resumo.dataInicio)} />
          <LinhaPdf
            label="Previsão de conclusão"
            value={resumo.previsaoConclusao ? formatDataBR(resumo.previsaoConclusao) : "—"}
          />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Financeiro</Text>
          <LinhaPdf label="Valor original" value={formatValor(resumo.valorOriginal)} />
          <LinhaPdf label="Desconto" value={descontoTexto} />
          <LinhaPdf label="Valor final" value={formatValor(resumo.valorFinal)} />
          <LinhaPdf label="Parcelamento" value={formatParcelas(resumo.numParcelas, resumo.valorParcela)} />
          <LinhaPdf label="Forma de pagamento" value={FORMA_PAGAMENTO_LABELS[resumo.formaPagamento]} />
          <LinhaPdf label="1ª mensalidade" value={formatDataBR(resumo.dataPrimeiraMensalidade)} />
        </View>

        {resumo.taxaMatriculaFinal !== null && resumo.taxaMatriculaFinal !== undefined && resumo.taxaMatriculaFinal > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Taxa de Matrícula</Text>
            <LinhaPdf
              label="Taxa de Matrícula"
              value={`${formatValor(resumo.taxaMatriculaFinal)} (${resumo.taxaMatriculaPaga ? "Paga" : "Pendente"})`}
            />
            <LinhaPdf
              label="Forma de pagamento"
              value={
                resumo.taxaMatriculaFormaPagamento
                  ? TAXA_MATRICULA_FORMA_PAGAMENTO_LABELS[resumo.taxaMatriculaFormaPagamento]
                  : "—"
              }
            />
          </View>
        )}

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Materiais entregues</Text>
          <LinhaPdf label="Apostila" value={resumo.apostilaEntregue ? "Sim" : "Não"} />
          <LinhaPdf label="Farda" value={resumo.fardaEntregue ? "Sim" : "Não"} />
          <LinhaPdf label="Kit" value={resumo.kitEntregue ? "Sim" : "Não"} />
        </View>

        {resumo.observacoes && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Observações</Text>
            <Text>{resumo.observacoes}</Text>
          </View>
        )}

        {resumo.termo_imagem_texto && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>AUTORIZAÇÃO DE USO DE IMAGEM E VOZ</Text>
            <Text style={pdfStyles.termoTexto}>{resumo.termo_imagem_texto}</Text>
            <Text style={pdfStyles.termoData}>Porto Real do Colégio/AL, ___/___/______</Text>

            <View style={pdfStyles.assinaturaBloco}>
              <View style={pdfStyles.assinaturaLinha} />
              <Text style={pdfStyles.assinaturaLabel}>Assinatura do Aluno ou Responsável</Text>
              <Text style={{ marginTop: 8 }}>Nome completo: {resumo.aluno.full_name ?? "—"}</Text>
              <Text>CPF: {formatCpf(resumo.aluno.cpf)}</Text>
            </View>

            {resumo.responsavelNome && (
              <View style={pdfStyles.assinaturaBloco}>
                <View style={pdfStyles.assinaturaLinha} />
                <Text style={pdfStyles.assinaturaLabel}>Assinatura do Responsável</Text>
                <Text style={{ marginTop: 8 }}>Responsável: {resumo.responsavelNome}</Text>
                <Text>CPF: {resumo.responsavelCpf ? formatCpf(resumo.responsavelCpf) : "—"}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={pdfStyles.footer}>
          Este comprovante confirma a matrícula do aluno acima e deve ser assinado e devolvido à
          secretaria da escola.
        </Text>
      </Page>
    </Document>
  );
}
