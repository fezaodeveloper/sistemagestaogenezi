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
  // campos existirem.
  escola_nome?: string;
  // Data URI do logo (configuracoes.escola_logo_url) — ver getLogoEscolaPdf.
  escola_logo_url?: string | null;
  escola_endereco?: string;
  escola_telefone?: string;
  escola_email?: string;
  // Curso gratuito BÔNUS da matrícula (matriculas.curso_bonus_id) — adicional ao curso
  // principal acima, nunca o substitui. Listado como linha própria, não dentro da seção
  // "Informações do Curso" (que é só do curso principal/pago).
  cursoBonusNome?: string;
  // Preenchidos manualmente pelo admin no momento da impressão (Dialog "aluno
  // é menor de idade?"), não vêm de nenhuma tabela — ver handleImprimirComprovante
  // em matricula-detalhes.tsx/matricula-wizard.tsx. Reaproveitado aqui só para
  // exibir o nome do responsável no rodapé (o bloco de assinatura/termo de
  // imagem que também usava isso foi removido — já existe formulário próprio
  // de assinatura de termo de imagem).
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
  header: { marginBottom: 12, borderBottomWidth: 2, borderBottomColor: "#000000", paddingBottom: 8, alignItems: "center" },
  escolaNome: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4, textAlign: "center" },
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
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    alignItems: "center",
  },
  footerNome: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center" },
  footerResponsavel: { fontSize: 9, color: "#555555", marginTop: 2, textAlign: "center" },
  footerEscola: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 8, textAlign: "center" },
  footerEscolaContato: { fontSize: 8, color: "#555555", marginTop: 2, textAlign: "center" },
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
          <Text style={pdfStyles.escolaNome}>{resumo.escola_nome ?? "GÊNEZI — Educação Profissional"}</Text>
          <Text style={pdfStyles.title}>COMPROVANTE DE MATRÍCULA</Text>
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

        {resumo.cursoBonusNome && (
          <View style={pdfStyles.section}>
            <LinhaPdf label="Curso Bônus" value={resumo.cursoBonusNome} />
          </View>
        )}

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

        <View style={pdfStyles.footer}>
          <Text style={pdfStyles.footerNome}>{resumo.aluno.full_name ?? "—"}</Text>
          {resumo.responsavelNome && (
            <Text style={pdfStyles.footerResponsavel}>Responsável: {resumo.responsavelNome}</Text>
          )}
          <Text style={pdfStyles.footerEscola}>{resumo.escola_nome ?? "GÊNEZI — Educação Profissional"}</Text>
          {(resumo.escola_endereco || resumo.escola_telefone || resumo.escola_email) && (
            <Text style={pdfStyles.footerEscolaContato}>
              {[resumo.escola_endereco, resumo.escola_telefone, resumo.escola_email].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
