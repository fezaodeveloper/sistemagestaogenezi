import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatCnpj } from "@/lib/configuracoes/schema";
import type { RelatorioMEI } from "./relatorio";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 20 },
  dadosBox: {
    borderWidth: 1,
    borderColor: "#000000",
    padding: 8,
    marginBottom: 16,
  },
  dadosLinha: { marginBottom: 3 },
  label: { fontFamily: "Helvetica-Bold" },
  secaoTitulo: {
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#e5e5e5",
    padding: 6,
    marginBottom: 4,
  },
  tabela: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 16,
  },
  linhaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  primeiraLinha: { borderTopWidth: 0 },
  itemLabel: { flexShrink: 1, paddingRight: 8 },
  itemValor: { fontFamily: "Helvetica-Bold" },
  totalGeral: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#000000",
    padding: 8,
    marginBottom: 32,
  },
  totalGeralLabel: { fontFamily: "Helvetica-Bold" },
  totalGeralValor: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  footer: { marginTop: 24, fontSize: 9 },
  footerLinha: { marginBottom: 4 },
  textoFinal: { marginTop: 24, fontSize: 9, textAlign: "justify" },
});

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ItemLinha({
  numero,
  label,
  valor,
  primeira,
}: {
  numero: string;
  label: string;
  valor: number;
  primeira?: boolean;
}) {
  return (
    <View style={[styles.linhaItem, primeira ? styles.primeiraLinha : undefined]}>
      <Text style={styles.itemLabel}>
        {numero} – {label}
      </Text>
      <Text style={styles.itemValor}>{formatValor(valor)}</Text>
    </View>
  );
}

function RelatorioMEIDocument({ relatorio }: { relatorio: RelatorioMEI }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>RELATÓRIO MENSAL DAS RECEITAS BRUTAS</Text>

        <View style={styles.dadosBox}>
          <Text style={styles.dadosLinha}>
            <Text style={styles.label}>CNPJ: </Text>
            {formatCnpj(relatorio.cnpj)}
          </Text>
          <Text style={styles.dadosLinha}>
            <Text style={styles.label}>Empreendedor individual: </Text>
            {relatorio.nomeEmpreendedor}
          </Text>
          <Text style={styles.dadosLinha}>
            <Text style={styles.label}>Período de apuração: </Text>
            {relatorio.periodoApuracao}
          </Text>
        </View>

        <Text style={styles.secaoTitulo}>
          RECEITA BRUTA MENSAL – REVENDA DE MERCADORIAS (COMÉRCIO)
        </Text>
        <View style={styles.tabela}>
          <ItemLinha numero="I" label="Revenda sem documento fiscal" valor={relatorio.comercioSemNota} primeira />
          <ItemLinha numero="II" label="Revenda com documento fiscal" valor={relatorio.comercioComNota} />
          <ItemLinha numero="III" label="Total comércio" valor={relatorio.totalComercio} />
        </View>

        <Text style={styles.secaoTitulo}>
          RECEITA BRUTA MENSAL – VENDA DE PRODUTOS INDUSTRIALIZADOS (INDÚSTRIA)
        </Text>
        <View style={styles.tabela}>
          <ItemLinha numero="IV" label="Venda sem documento fiscal" valor={relatorio.industriaSemNota} primeira />
          <ItemLinha numero="V" label="Venda com documento fiscal" valor={relatorio.industriaComNota} />
          <ItemLinha numero="VI" label="Total indústria" valor={relatorio.totalIndustria} />
        </View>

        <Text style={styles.secaoTitulo}>RECEITA BRUTA MENSAL – PRESTAÇÃO DE SERVIÇOS</Text>
        <View style={styles.tabela}>
          <ItemLinha numero="VII" label="Serviços sem documento fiscal" valor={relatorio.servicosSemNota} primeira />
          <ItemLinha numero="VIII" label="Serviços com documento fiscal" valor={relatorio.servicosComNota} />
          <ItemLinha numero="IX" label="Total serviços" valor={relatorio.totalServicos} />
        </View>

        <View style={styles.totalGeral}>
          <Text style={styles.totalGeralLabel}>X – Total geral</Text>
          <Text style={styles.totalGeralValor}>{formatValor(relatorio.totalGeral)}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLinha}>
            LOCAL E DATA: _______________________________     ASSINATURA DO EMPRESÁRIO: _______________________________
          </Text>
        </View>

        <Text style={styles.textoFinal}>
          ENCONTRAM-SE ANEXADOS A ESTE RELATÓRIO: os documentos fiscais e demais comprovantes das receitas
          brutas apuradas no período, conforme exigido pela legislação do Microempreendedor Individual (MEI).
        </Text>
      </Page>
    </Document>
  );
}

export async function gerarRelatorioMEIPdf(relatorio: RelatorioMEI): Promise<Buffer> {
  return renderToBuffer(<RelatorioMEIDocument relatorio={relatorio} />);
}
