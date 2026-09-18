import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { FrequenciaTurmaDados } from "@/lib/relatorios/frequencia-turma";
import { LogoEscolaPdf } from "@/components/pdf/logo-escola-pdf";
import { carregarLogoEscolaParaPdf } from "@/lib/pdf/logo-escola";

// Landscape (REGRA da tarefa) — tabela com 5 colunas fica apertada em
// retrato. Mesma convenção de estilos de src/lib/contratos/pdf.tsx.
const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 10 },
  nomeEscola: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitulo: { fontSize: 10, color: "#333333" },
  table: { borderWidth: 1, borderColor: "#cccccc" },
  tableRowHeader: { flexDirection: "row", backgroundColor: "#0f172a" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#cccccc" },
  cellHeader: { padding: 6, fontFamily: "Helvetica-Bold", fontSize: 9, color: "#ffffff" },
  cell: { padding: 6, fontSize: 9 },
  colAluno: { width: "40%" },
  colNumero: { width: "15%", textAlign: "center" },
  footer: { marginTop: 16, fontSize: 8, color: "#555555", textAlign: "right" },
});

function FrequenciaTurmaPdfDocument({ dados, escolaLogo }: { dados: FrequenciaTurmaDados; escolaLogo: string | null }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <LogoEscolaPdf logoUrl={escolaLogo} />
          <Text style={pdfStyles.nomeEscola}>{dados.escolaNome}</Text>
          <Text style={pdfStyles.subtitulo}>
            {dados.cursoNome} — Turma {dados.turmaNome}
          </Text>
          <Text style={pdfStyles.subtitulo}>Período: {dados.periodo}</Text>
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableRowHeader}>
            <Text style={[pdfStyles.cellHeader, pdfStyles.colAluno]}>Aluno</Text>
            <Text style={[pdfStyles.cellHeader, pdfStyles.colNumero]}>Total Aulas</Text>
            <Text style={[pdfStyles.cellHeader, pdfStyles.colNumero]}>Presenças</Text>
            <Text style={[pdfStyles.cellHeader, pdfStyles.colNumero]}>Faltas</Text>
            <Text style={[pdfStyles.cellHeader, pdfStyles.colNumero]}>% Frequência</Text>
          </View>
          {dados.alunos.map((aluno, indice) => (
            <View key={`${aluno.nome}-${indice}`} style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.cell, pdfStyles.colAluno]}>{aluno.nome}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.colNumero]}>{aluno.totalAulas}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.colNumero]}>{aluno.presencas}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.colNumero]}>{aluno.faltas}</Text>
              <Text style={[pdfStyles.cell, pdfStyles.colNumero]}>{aluno.percentual}%</Text>
            </View>
          ))}
        </View>

        <Text style={pdfStyles.footer}>Gerado em {dados.geradoEm}</Text>
      </Page>
    </Document>
  );
}

export async function gerarPdfFrequenciaTurma(dados: FrequenciaTurmaDados): Promise<Buffer> {
  const escolaLogo = await carregarLogoEscolaParaPdf();
  return renderToBuffer(<FrequenciaTurmaPdfDocument dados={dados} escolaLogo={escolaLogo} />);
}
