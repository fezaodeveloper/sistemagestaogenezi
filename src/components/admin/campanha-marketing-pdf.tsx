import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CAMPANHA_STATUS_LABELS, type CampanhaMarketing } from "@/lib/campanhas/schema";
import { LogoEscolaPdf } from "@/components/pdf/logo-escola-pdf";

const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  header: { marginBottom: 14, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 8 },
  escola: { fontSize: 10, color: "#555555" },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
    padding: 3,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: "35%", color: "#555555" },
  value: { width: "65%", fontFamily: "Helvetica-Bold" },
  texto: { textAlign: "justify" },
  linkLinha: { marginBottom: 3 },
  linkRotulo: { fontFamily: "Helvetica-Bold" },
  linkUrl: { color: "#1d4ed8", textDecoration: "underline" },
  vazio: { color: "#777777" },
});

function formatMoeda(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <View style={pdfStyles.row}>
      <Text style={pdfStyles.label}>{label}</Text>
      <Text style={pdfStyles.value}>{value}</Text>
    </View>
  );
}

export function CampanhaMarketingPdf({
  campanha,
  escolaLogo,
  geradoEm,
}: {
  campanha: CampanhaMarketing;
  escolaLogo: string | null;
  geradoEm: string;
}) {
  const orcamentoTotal = (campanha.orcamento_trafego ?? 0) + (campanha.orcamento_impressao ?? 0);
  const links = campanha.links ?? [];
  const meta = campanha.meta_alunos ?? null;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <LogoEscolaPdf logoUrl={escolaLogo} />
          <Text style={pdfStyles.escola}>Campanha de marketing</Text>
          <Text style={pdfStyles.titulo}>{campanha.nome}</Text>
          <Text style={pdfStyles.meta}>Emitido em {geradoEm}</Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Resumo</Text>
          <Linha label="Status" value={CAMPANHA_STATUS_LABELS[campanha.status]} />
          <Linha label="Meta de alunos" value={meta !== null ? String(meta) : "—"} />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Descrição</Text>
          {campanha.descricao ? (
            <Text style={pdfStyles.texto}>{campanha.descricao}</Text>
          ) : (
            <Text style={pdfStyles.vazio}>Sem descrição.</Text>
          )}
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Orçamento</Text>
          <Linha label="Tráfego pago" value={formatMoeda(campanha.orcamento_trafego)} />
          <Linha label="Impressão" value={formatMoeda(campanha.orcamento_impressao)} />
          <Linha label="Total" value={formatMoeda(orcamentoTotal)} />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Links</Text>
          {links.length === 0 ? (
            <Text style={pdfStyles.vazio}>Nenhum link cadastrado.</Text>
          ) : (
            links.map((link, indice) => (
              <View key={`${link.url}-${indice}`} style={pdfStyles.linkLinha}>
                <Text style={pdfStyles.linkRotulo}>{link.label}</Text>
                <Link src={link.url} style={pdfStyles.linkUrl}>
                  {link.url}
                </Link>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  );
}
