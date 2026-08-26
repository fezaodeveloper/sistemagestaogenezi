import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TurmaWithCurso } from "@/lib/turmas/schema";

export type FrequenciaAlunoPdf = {
  matriculaId: string;
  nome: string;
  totalAulas: number;
  presencas: number;
  faltas: number;
  percentual: number;
  apto: boolean;
};

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC).
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 18, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingVertical: 4,
    marginTop: 8,
  },
  headerCell: { fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 4,
  },
  cell: { paddingHorizontal: 2 },
  footer: { marginTop: 16, fontSize: 9, fontFamily: "Helvetica-Bold" },
});

const COLUNAS = [
  { chave: "nome", label: "Aluno", width: "34%" },
  { chave: "total", label: "Total de aulas", width: "16%" },
  { chave: "presencas", label: "Presenças", width: "14%" },
  { chave: "faltas", label: "Faltas", width: "12%" },
  { chave: "percentual", label: "% Frequência", width: "12%" },
  { chave: "status", label: "Status", width: "12%" },
] as const;

export function TurmaFrequenciaPdf({
  turma,
  frequencias,
  geradoEm,
}: {
  turma: TurmaWithCurso;
  frequencias: FrequenciaAlunoPdf[];
  geradoEm: string;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>GÊNEZI — Relatório de Frequência</Text>
          <Text style={pdfStyles.subtitle}>
            {turma.nome} — {turma.cursos?.nome ?? "—"}
          </Text>
          <Text style={pdfStyles.meta}>
            Período: {formatDataBR(turma.data_inicio)} a {formatDataBR(turma.data_fim)}
          </Text>
          <Text style={pdfStyles.meta}>Gerado em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.headerRow}>
          {COLUNAS.map((coluna) => (
            <Text
              key={coluna.chave}
              style={[pdfStyles.cell, pdfStyles.headerCell, { width: coluna.width }]}
            >
              {coluna.label}
            </Text>
          ))}
        </View>

        {frequencias.map((aluno) => (
          <View key={aluno.matriculaId} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "34%" }]}>{aluno.nome}</Text>
            <Text style={[pdfStyles.cell, { width: "16%" }]}>{aluno.totalAulas}</Text>
            <Text style={[pdfStyles.cell, { width: "14%" }]}>{aluno.presencas}</Text>
            <Text style={[pdfStyles.cell, { width: "12%" }]}>{aluno.faltas}</Text>
            <Text style={[pdfStyles.cell, { width: "12%" }]}>{aluno.percentual}%</Text>
            <Text style={[pdfStyles.cell, { width: "12%" }]}>{aluno.apto ? "Apto" : "Inapto"}</Text>
          </View>
        ))}

        <Text style={pdfStyles.footer}>Mínimo para certificado: 75%</Text>
      </Page>
    </Document>
  );
}
