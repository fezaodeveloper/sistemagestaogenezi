import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { tiptapJsonParaRuns } from "@/lib/certificados/texto";
import type { Termo } from "./schema";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 10 },
  nomeEscola: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 20 },
  paragrafo: { marginBottom: 8, textAlign: "justify" },
  assinatura: { marginTop: 48, alignItems: "center" },
  assinaturaLinha: { width: "60%", borderTopWidth: 1, borderTopColor: "#000000", paddingTop: 4 },
  assinaturaNome: { fontSize: 9, textAlign: "center" },
  footer: { marginTop: 24, fontSize: 8, textAlign: "center", color: "#555555" },
});

// Texto simples (sem negrito/sublinhado/tamanho) — mais simples que o PDF
// de contrato, que preserva formatação (ver lib/contratos/pdf.tsx).
// tiptapJsonParaRuns ainda resolve as variáveis {chave} e insere "\n" entre
// parágrafos; só a formatação rica é descartada aqui.
function extrairParagrafos(doc: Termo["conteudo_json"], variaveis: Record<string, string>): string[] {
  const texto = tiptapJsonParaRuns(doc, variaveis)
    .map((run) => run.texto)
    .join("");
  return texto.split("\n").filter((linha) => linha.trim().length > 0);
}

function TermoPdfDocument({
  termo,
  variaveis,
  nomeEscola,
  nomeAssinatura,
  dataAceite,
}: {
  termo: Termo;
  variaveis: Record<string, string>;
  nomeEscola: string;
  nomeAssinatura: string | null;
  dataAceite: string | null;
}) {
  const paragrafos = extrairParagrafos(termo.conteudo_json, variaveis);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.nomeEscola}>{nomeEscola}</Text>
        </View>

        <Text style={styles.titulo}>{termo.titulo.toUpperCase()}</Text>

        {paragrafos.map((paragrafo, indice) => (
          <Text key={indice} style={[styles.paragrafo, { color: termo.cor_texto }]}>
            {paragrafo}
          </Text>
        ))}

        <View style={styles.assinatura}>
          <View style={styles.assinaturaLinha} />
          <Text style={styles.assinaturaNome}>{nomeAssinatura ?? "Assinatura"}</Text>
        </View>

        <Text style={styles.footer}>
          {dataAceite
            ? `Aceito digitalmente em ${dataAceite}.`
            : `Documento gerado em ${new Date().toLocaleDateString("pt-BR")}.`}
        </Text>
      </Page>
    </Document>
  );
}

export async function gerarTermoPdfBuffer(
  termo: Termo,
  variaveis: Record<string, string>,
  nomeEscola: string,
  nomeAssinatura: string | null,
  dataAceite: string | null,
): Promise<Buffer> {
  return renderToBuffer(
    <TermoPdfDocument
      termo={termo}
      variaveis={variaveis}
      nomeEscola={nomeEscola}
      nomeAssinatura={nomeAssinatura}
      dataAceite={dataAceite}
    />,
  );
}
