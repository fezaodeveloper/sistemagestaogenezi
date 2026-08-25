import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCpf, formatTelefone } from "@/lib/alunos/schema";
import { CURSO_TIPO_LABELS, type CURSO_TIPOS } from "@/lib/cursos/schema";
import { DIA_SEMANA_LABELS, type DIAS_SEMANA } from "@/lib/turmas/schema";
import {
  DESCONTO_TIPO_LABELS,
  FORMA_PAGAMENTO_LABELS,
  type DescontoFormato,
  type DescontoTipo,
  type FormaPagamento,
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
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 18, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
    padding: 4,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: "40%", color: "#555555" },
  value: { width: "60%", fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 24, fontSize: 9, textAlign: "center", color: "#555555" },
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
          <Text style={pdfStyles.title}>GÊNEZI — Educação Profissional</Text>
          <Text style={pdfStyles.subtitle}>Comprovante de Matrícula</Text>
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
          <Text style={pdfStyles.sectionTitle}>Curso e Turma</Text>
          <LinhaPdf label="Curso" value={resumo.curso.nome} />
          <LinhaPdf label="Modalidade" value={CURSO_TIPO_LABELS[resumo.curso.tipo]} />
          <LinhaPdf
            label="Carga horária"
            value={resumo.curso.carga_horaria_horas ? `${resumo.curso.carga_horaria_horas}h` : "—"}
          />
          <LinhaPdf label="Turma" value={resumo.turma.nome} />
          <LinhaPdf label="Dias da semana" value={formatDiasSemana(resumo.turma.cadencia_dias_semana)} />
          <LinhaPdf label="Horário" value={resumo.turma.horario_aula ?? "—"} />
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

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Datas</Text>
          <LinhaPdf label="Início" value={formatDataBR(resumo.dataInicio)} />
          <LinhaPdf
            label="Previsão de conclusão"
            value={resumo.previsaoConclusao ? formatDataBR(resumo.previsaoConclusao) : "—"}
          />
        </View>

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

        <Text style={pdfStyles.footer}>
          Este comprovante confirma a matrícula do aluno acima.
        </Text>
      </Page>
    </Document>
  );
}
