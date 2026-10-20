import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCpf } from "@/lib/alunos/schema";
import { LogoEscolaPdf } from "@/components/pdf/logo-escola-pdf";

// Estilos/helpers próprios (não importados de matricula-comprovante-pdf.tsx): pdfStyles/LinhaPdf
// lá não são exportados — cada PDF deste projeto já define o próprio conjunto mínimo (mesmo
// padrão de src/lib/contratos/pdf.tsx), então duplicar aqui é intencional, não descuido.

export type ResumoReciboParcela = {
  parcelaId: string;
  aluno: { full_name: string | null; cpf: string };
  cursoNome: string;
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  asaasPaymentId: string | null;
  escolaNome?: string;
  escolaLogoUrl?: string | null;
};

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar `new Date(...)` direto
// numa string de data pura (interpretada como UTC), mesmo critério de matricula-comprovante-pdf.
function formatDataBR(isoDate: string | null): string {
  if (!isoDate) return "—";
  const [ano, mes, dia] = isoDate.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 8 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 6 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
    padding: 3,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "35%", color: "#555555" },
  value: { width: "65%", fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 24, fontSize: 9, textAlign: "center", color: "#555555" },
});

function LinhaRecibo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ParcelaReciboPdf({ resumo, geradoEm }: { resumo: ResumoReciboParcela; geradoEm: string }) {
  const numeroRecibo = resumo.parcelaId.slice(-8).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <LogoEscolaPdf logoUrl={resumo.escolaLogoUrl} />
          <Text style={styles.title}>{resumo.escolaNome ?? "GÊNEZI — Educação Profissional"}</Text>
          <Text style={styles.subtitle}>RECIBO DE PAGAMENTO</Text>
          <Text style={styles.meta}>
            Recibo nº {numeroRecibo} · Emitido em {geradoEm}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pagador</Text>
          <LinhaRecibo label="Nome" value={resumo.aluno.full_name ?? "—"} />
          <LinhaRecibo label="CPF" value={formatCpf(resumo.aluno.cpf)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pagamento</Text>
          <LinhaRecibo
            label="Descrição"
            value={`Parcela ${resumo.numeroParcela}/${resumo.totalParcelas} — Curso: ${resumo.cursoNome}`}
          />
          <LinhaRecibo label="Valor pago" value={formatValor(resumo.valor)} />
          <LinhaRecibo label="Vencimento" value={formatDataBR(resumo.dataVencimento)} />
          <LinhaRecibo label="Data do pagamento" value={formatDataBR(resumo.dataPagamento)} />
          {resumo.asaasPaymentId && <LinhaRecibo label="Identificador Asaas" value={resumo.asaasPaymentId} />}
        </View>

        <Text style={styles.footer}>Este recibo comprova o pagamento da parcela acima.</Text>
      </Page>
    </Document>
  );
}
