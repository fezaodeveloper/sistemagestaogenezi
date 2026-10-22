import { Circle, Document, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
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
  observacoes?: string | null;
  escolaNome?: string;
  escolaLogoUrl?: string | null;
  escolaEndereco?: string;
  escolaTelefone?: string;
  escolaEmail?: string;
  // Quem emitiu (configuracoes.nome_diretor) — mostrado no rodapé do modelo aprovado.
  nomeDiretor?: string | null;
};

// Mesma paleta de matricula-comprovante-pdf.tsx (ver comentário lá sobre não compartilhar
// StyleSheet entre PDFs deste projeto).
const AZUL_ESCURO = "#1a3a6b";
const AZUL_MEDIO = "#2980d4";
const AZUL_CLARO = "#cfe0f5";
const LINHA_ALT = "#f0f4f8";
const VERDE_BORDA = "#1e7e34";
const VERDE_FUNDO = "#e6f4ea";

// Sem campo em configuracoes pra isso (diferente do slogan do comprovante de matrícula, que ao
// menos foi checado) — frase fixa do modelo aprovado, decorativa, do lado direito do cabeçalho.
const SLOGAN_LATERAL = "EDUCAÇÃO QUE TRANSFORMA REALIDADES";
const FAIXA_RODAPE = "CONHECIMENTO • HABILIDADES • NOVAS OPORTUNIDADES";

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
  page: { fontSize: 9, fontFamily: "Helvetica" },
  conteudo: { padding: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AZUL_ESCURO,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoFallbackTexto: { color: "#ffffff", fontSize: 16, fontFamily: "Helvetica-Bold" },
  escolaNome: { fontSize: 12, fontFamily: "Helvetica-Bold", color: AZUL_ESCURO },
  slogan: { fontSize: 7, color: "#777777", marginTop: 2 },
  sloganLateral: { fontSize: 7, color: AZUL_MEDIO, fontFamily: "Helvetica-Bold", maxWidth: 70, textAlign: "right" },
  divisoria: { height: 2, backgroundColor: AZUL_ESCURO, marginTop: 10, marginBottom: 10 },
  tituloBlocoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tituloLinha: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  tituloPreto: { color: "#000000" },
  tituloAzul: { color: AZUL_MEDIO },
  subtitulo: { fontSize: 9, color: "#555555", marginTop: 2 },
  caixaRecibo: {
    backgroundColor: LINHA_ALT,
    borderWidth: 1,
    borderColor: AZUL_MEDIO,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 150,
  },
  caixaReciboTitulo: { fontFamily: "Helvetica-Bold", color: AZUL_ESCURO, fontSize: 9 },
  caixaReciboMeta: { fontSize: 8, color: "#555555", marginTop: 2 },
  secaoHeader: { backgroundColor: AZUL_ESCURO, paddingVertical: 4, paddingHorizontal: 6, marginTop: 12 },
  secaoHeaderTexto: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  linha: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6 },
  linhaLabel: { width: "35%", color: "#555555" },
  linhaValor: { width: "65%", fontFamily: "Helvetica-Bold" },
  confirmacao: {
    backgroundColor: VERDE_FUNDO,
    borderWidth: 1,
    borderColor: VERDE_BORDA,
    borderRadius: 4,
    paddingVertical: 10,
    marginTop: 14,
    alignItems: "center",
  },
  confirmacaoTitulo: { color: VERDE_BORDA, fontFamily: "Helvetica-Bold", fontSize: 11 },
  confirmacaoTexto: { color: VERDE_BORDA, fontSize: 9, marginTop: 2 },
  observacoesTexto: { paddingHorizontal: 6, paddingVertical: 4 },
  footer: { marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: AZUL_ESCURO, alignItems: "center" },
  footerDiretor: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center" },
  footerEscola: { fontSize: 9, fontFamily: "Helvetica-Bold", color: AZUL_ESCURO, marginTop: 4, textAlign: "center" },
  footerContato: { fontSize: 8, color: "#555555", marginTop: 2, textAlign: "center" },
  faixaRodape: {
    backgroundColor: AZUL_ESCURO,
    marginTop: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  faixaRodapeTexto: { color: "#ffffff", fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
});

function LinhaRecibo({ label, value, indice }: { label: string; value: string; indice: number }) {
  return (
    <View style={[styles.linha, { backgroundColor: indice % 2 === 0 ? "#ffffff" : LINHA_ALT }]}>
      <Text style={styles.linhaLabel}>{label}</Text>
      <Text style={styles.linhaValor}>{value}</Text>
    </View>
  );
}

// Mesma decoração geométrica do comprovante de matrícula (ver comentário lá) — triângulo nos
// cantos superior-esquerdo/inferior-direito, sem position absolute.
function TrianguloCanto({ variante }: { variante: "superior-esquerdo" | "inferior-direito" }) {
  const pontos = variante === "superior-esquerdo" ? "0,0 70,0 0,55" : "70,0 70,55 0,55";
  return (
    <Svg width={70} height={55}>
      <Polygon points={pontos} fill={AZUL_ESCURO} />
    </Svg>
  );
}

function GradePontos() {
  const espacamento = 10;
  const pontos = [];
  for (let linha = 0; linha < 3; linha++) {
    for (let coluna = 0; coluna < 3; coluna++) {
      pontos.push(
        <Circle key={`${linha}-${coluna}`} cx={coluna * espacamento + 4} cy={linha * espacamento + 4} r={1.5} fill={AZUL_CLARO} />,
      );
    }
  }
  return <Svg width={36} height={36}>{pontos}</Svg>;
}

export function ParcelaReciboPdf({ resumo, geradoEm }: { resumo: ResumoReciboParcela; geradoEm: string }) {
  const numeroRecibo = resumo.parcelaId.slice(-8).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <TrianguloCanto variante="superior-esquerdo" />

        <View style={styles.conteudo}>
          <View style={styles.headerRow}>
            <View>
              {resumo.escolaLogoUrl ? (
                <LogoEscolaPdf logoUrl={resumo.escolaLogoUrl} />
              ) : (
                <View style={styles.logoFallback}>
                  <Text style={styles.logoFallbackTexto}>G</Text>
                </View>
              )}
              <Text style={styles.escolaNome}>{resumo.escolaNome ?? "Gênezi Educação Profissional"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <GradePontos />
              <Text style={styles.sloganLateral}>{SLOGAN_LATERAL}</Text>
            </View>
          </View>

          <View style={styles.divisoria} />

          <View style={styles.tituloBlocoRow}>
            <View>
              <Text style={styles.tituloLinha}>
                <Text style={styles.tituloPreto}>RECIBO </Text>
                <Text style={styles.tituloAzul}>DE PAGAMENTO</Text>
              </Text>
              <Text style={styles.subtitulo}>Comprovante de pagamento de mensalidade</Text>
            </View>
            <View style={styles.caixaRecibo}>
              <Text style={styles.caixaReciboTitulo}>Recibo nº {numeroRecibo}</Text>
              <Text style={styles.caixaReciboMeta}>Emitido em {geradoEm} 📅</Text>
            </View>
          </View>

          <View style={styles.secaoHeader}>
            <Text style={styles.secaoHeaderTexto}>👤 PAGADOR</Text>
          </View>
          <LinhaRecibo indice={0} label="Nome" value={resumo.aluno.full_name ?? "—"} />
          <LinhaRecibo indice={1} label="CPF" value={formatCpf(resumo.aluno.cpf)} />

          <View style={styles.secaoHeader}>
            <Text style={styles.secaoHeaderTexto}>💳 INFORMAÇÕES DO PAGAMENTO</Text>
          </View>
          <LinhaRecibo
            indice={0}
            label="Descrição"
            value={`Parcela ${resumo.numeroParcela}/${resumo.totalParcelas} — Curso: ${resumo.cursoNome}`}
          />
          <LinhaRecibo indice={1} label="Valor pago" value={formatValor(resumo.valor)} />
          <LinhaRecibo indice={2} label="Vencimento" value={formatDataBR(resumo.dataVencimento)} />
          <LinhaRecibo indice={3} label="Data do pagamento" value={formatDataBR(resumo.dataPagamento)} />
          {resumo.asaasPaymentId && <LinhaRecibo indice={4} label="Identificador Asaas" value={resumo.asaasPaymentId} />}

          <View style={styles.confirmacao}>
            <Text style={styles.confirmacaoTitulo}>✅ PAGAMENTO CONFIRMADO</Text>
            <Text style={styles.confirmacaoTexto}>Este recibo comprova o pagamento da parcela acima.</Text>
          </View>

          <View style={styles.secaoHeader}>
            <Text style={styles.secaoHeaderTexto}>📝 OBSERVAÇÕES</Text>
          </View>
          <Text style={styles.observacoesTexto}>{resumo.observacoes || "-"}</Text>

          <View style={styles.footer}>
            {resumo.nomeDiretor && <Text style={styles.footerDiretor}>{resumo.nomeDiretor}</Text>}
            <Text style={styles.footerEscola}>{resumo.escolaNome ?? "Gênezi Educação Profissional"}</Text>
            {(resumo.escolaEndereco || resumo.escolaTelefone || resumo.escolaEmail) && (
              <Text style={styles.footerContato}>
                {[
                  resumo.escolaEndereco ? `📍 ${resumo.escolaEndereco}` : null,
                  resumo.escolaTelefone ? `📞 ${resumo.escolaTelefone}` : null,
                  resumo.escolaEmail ? `✉️ ${resumo.escolaEmail}` : null,
                ]
                  .filter(Boolean)
                  .join("   ")}
              </Text>
            )}
          </View>

          <View style={styles.faixaRodape}>
            <Text style={styles.faixaRodapeTexto}>{FAIXA_RODAPE}</Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: -28 }}>
            <TrianguloCanto variante="inferior-direito" />
          </View>
        </View>
      </Page>
    </Document>
  );
}
