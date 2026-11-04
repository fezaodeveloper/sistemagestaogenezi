import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LogoEscolaPdf } from "@/components/pdf/logo-escola-pdf";

// Desativa a hifenização automática (mesmo motivo de parcela-recibo-pdf.tsx: o hifenizador
// padrão só reconhece inglês e quebra palavras em português no lugar errado).
Font.registerHyphenationCallback((word) => [word]);

// SEM EMOJI nos textos deste PDF — Helvetica (fonte base-14 do @react-pdf/pdfkit) não tem glifo
// pra emoji; um emoji do bloco suplementar (ex.: 🎯) vira lixo tipo "=d" no PDF renderizado (causa
// raiz detalhada em parcela-recibo-pdf.tsx). A tela pública/admin pode usar emoji livremente — só
// este componente de PDF evita.

export type RespostaEtapaPdf = { pergunta: string; resposta: string };

export type ResumoResultadoCampanha = {
  tituloCampanha: string;
  dataInscricao: string;
  participante: { nome: string; whatsapp: string; email: string | null; idade: number | null };
  habilitarPontuacao: boolean;
  pontuacaoTotal: number;
  pontuacaoMaxima: number;
  pontuacaoPercentual: number;
  aprovado: boolean;
  respostasPorEtapa: { tituloEtapa: string; respostas: RespostaEtapaPdf[] }[];
  escolaNome?: string;
  escolaLogoUrl?: string | null;
};

const AZUL_ESCURO = "#1a3a6b";
const AZUL_MEDIO = "#2980d4";
const VERDE_BORDA = "#1e7e34";
const VERDE_FUNDO = "#e6f4ea";
const VERMELHO_BORDA = "#b91c1c";
const VERMELHO_FUNDO = "#fde8e8";
const LINHA_ALT = "#f0f4f8";

const styles = StyleSheet.create({
  page: { fontSize: 9, fontFamily: "Helvetica", padding: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  escolaNome: { fontSize: 12, fontFamily: "Helvetica-Bold", color: AZUL_ESCURO },
  dataEmissao: { fontSize: 8, color: "#555555" },
  divisoria: { height: 2, backgroundColor: AZUL_ESCURO, marginTop: 10, marginBottom: 10 },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: AZUL_MEDIO },
  subtitulo: { fontSize: 9, color: "#555555", marginTop: 2 },
  secaoHeader: { backgroundColor: AZUL_ESCURO, paddingVertical: 4, paddingHorizontal: 6, marginTop: 12 },
  secaoHeaderTexto: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  linha: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6 },
  linhaLabel: { width: "35%", color: "#555555" },
  linhaValor: { width: "65%", fontFamily: "Helvetica-Bold" },
  resultadoBox: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 14,
    alignItems: "center",
  },
  resultadoPontuacao: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  resultadoStatus: { fontSize: 10, marginTop: 2, fontFamily: "Helvetica-Bold" },
  etapaBloco: { marginTop: 4 },
  etapaTitulo: { fontSize: 9, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 3, color: AZUL_ESCURO },
  perguntaTexto: { paddingHorizontal: 6, color: "#555555" },
  respostaTexto: { paddingHorizontal: 6, paddingBottom: 3, fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: AZUL_ESCURO, alignItems: "center" },
  footerEscola: { fontSize: 9, fontFamily: "Helvetica-Bold", color: AZUL_ESCURO, textAlign: "center" },
  footerContato: { fontSize: 8, color: "#555555", marginTop: 2, textAlign: "center" },
});

function LinhaResultado({ label, value, indice }: { label: string; value: string; indice: number }) {
  return (
    <View style={[styles.linha, { backgroundColor: indice % 2 === 0 ? "#ffffff" : LINHA_ALT }]}>
      <Text style={styles.linhaLabel}>{label}</Text>
      <Text style={styles.linhaValor}>{value}</Text>
    </View>
  );
}

export function CampanhaResultadoPdf({ resumo, geradoEm }: { resumo: ResumoResultadoCampanha; geradoEm: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <LogoEscolaPdf logoUrl={resumo.escolaLogoUrl} />
            <Text style={styles.escolaNome}>{resumo.escolaNome ?? "Gênezi Educação Profissional"}</Text>
          </View>
          <Text style={styles.dataEmissao}>Impresso em {geradoEm}</Text>
        </View>

        <View style={styles.divisoria} />

        <Text style={styles.titulo}>Resultado da inscrição</Text>
        <Text style={styles.subtitulo}>Campanha: {resumo.tituloCampanha}</Text>

        <View style={styles.secaoHeader}>
          <Text style={styles.secaoHeaderTexto}>DADOS DO PARTICIPANTE</Text>
        </View>
        <LinhaResultado indice={0} label="Nome" value={resumo.participante.nome} />
        <LinhaResultado indice={1} label="WhatsApp" value={resumo.participante.whatsapp} />
        {resumo.participante.email && <LinhaResultado indice={2} label="Email" value={resumo.participante.email} />}
        {resumo.participante.idade !== null && (
          <LinhaResultado indice={3} label="Idade" value={`${resumo.participante.idade} anos`} />
        )}
        <LinhaResultado indice={4} label="Data da inscrição" value={resumo.dataInscricao} />

        {resumo.habilitarPontuacao && (
          <View
            style={[
              styles.resultadoBox,
              resumo.aprovado
                ? { backgroundColor: VERDE_FUNDO, borderColor: VERDE_BORDA }
                : { backgroundColor: VERMELHO_FUNDO, borderColor: VERMELHO_BORDA },
            ]}
          >
            <Text style={[styles.resultadoPontuacao, { color: resumo.aprovado ? VERDE_BORDA : VERMELHO_BORDA }]}>
              Pontuação: {resumo.pontuacaoTotal}/{resumo.pontuacaoMaxima} ({resumo.pontuacaoPercentual}%)
            </Text>
            <Text style={[styles.resultadoStatus, { color: resumo.aprovado ? VERDE_BORDA : VERMELHO_BORDA }]}>
              {resumo.aprovado ? "APROVADO" : "NÃO APROVADO"}
            </Text>
          </View>
        )}

        {resumo.respostasPorEtapa.length > 0 && (
          <>
            <View style={styles.secaoHeader}>
              <Text style={styles.secaoHeaderTexto}>RESPOSTAS</Text>
            </View>
            {resumo.respostasPorEtapa.map((etapa, indiceEtapa) => (
              <View key={indiceEtapa} style={styles.etapaBloco}>
                <Text style={styles.etapaTitulo}>{etapa.tituloEtapa}</Text>
                {etapa.respostas.map((item, indice) => (
                  <View key={indice}>
                    <Text style={styles.perguntaTexto}>{item.pergunta}</Text>
                    <Text style={styles.respostaTexto}>{item.resposta}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerEscola}>{resumo.escolaNome ?? "Gênezi Educação Profissional"}</Text>
          <Text style={styles.footerContato}>Documento gerado automaticamente — {geradoEm}</Text>
        </View>
      </Page>
    </Document>
  );
}
