import { DIA_SEMANA_EXTENSO, type DiaSemana } from "@/lib/datas/util";

export const STATUS_ALUNO_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  trancado: "Trancado",
  formado: "Formado",
};

export const STATUS_MATRICULA_LABELS: Record<string, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
  transferida: "Transferida",
  inativa: "Inativa",
};

export const STATUS_PARCELA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Vencido",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export const STATUS_PARCELA_BADGE: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
  pago: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  atrasado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  cancelado: "bg-muted text-muted-foreground",
  estornado: "bg-muted text-muted-foreground",
};

export const STATUS_PRESENCA_LABELS: Record<string, string> = {
  presente: "Presente",
  falta: "Falta",
  justificada: "Justificada",
  reposicao: "Reposição",
};

export const STATUS_PRESENCA_BADGE: Record<string, string> = {
  presente: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falta: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  justificada: "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
  reposicao: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
};

export const TIPO_EVENTO_LABELS: Record<string, string> = {
  feriado: "Feriado",
  prova: "Prova",
  evento: "Evento",
  aula: "Aula",
  outro: "Outro",
};

// Cores por tipo pedidas na tarefa: feriados em vermelho, aulas em azul, eventos em amarelo.
// "prova"/"outro" (fora do pedido original) usam uma variação neutra de "evento".
export const TIPO_EVENTO_COR: Record<string, string> = {
  feriado: "text-red-500",
  aula: "text-cyan-500",
  evento: "text-amber-500",
  prova: "text-amber-500",
  outro: "text-muted-foreground",
};

export function formatValor(valor: number): string {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// dd/mm/aaaa a partir de "yyyy-mm-dd"/timestamptz — evita o desvio de fuso de usar `new
// Date(...)` direto numa string de data pura (interpretada como UTC), mesmo critério já usado em
// todo o projeto.
export function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// "jan/2026" a partir de "2026-01-15" — chave de agrupamento mensal da seção Frequência.
export function formatMesAno(iso: string): string {
  const [ano, mes] = iso.slice(0, 10).split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1]}/${ano}`;
}

// "HH:MM" a partir de "HH:MM:SS" (coluna `time` do Postgres).
export function formatHorario(horario: string | null): string | null {
  if (!horario) return null;
  return horario.slice(0, 5);
}

const ORDEM_DIA_SEMANA: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DIA_SEMANA_ABREV: Record<DiaSemana, string> = {
  domingo: "Dom",
  segunda: "Seg",
  terca: "Ter",
  quarta: "Qua",
  quinta: "Qui",
  sexta: "Sex",
  sabado: "Sáb",
};

// "Segunda e Quarta, 19:00–21:00" a partir da cadência + horários da turma — usado nos cards de
// Início e na seção Curso. Sem cadência configurada (curso EAD ou turma ainda sem cronograma):
// retorna null, e quem chama decide o fallback.
export function formatHorarioTurma(
  cadenciaDiasSemana: string[] | null,
  horarioAula: string | null,
  horarioFim: string | null,
): string | null {
  const inicio = formatHorario(horarioAula);
  if (!cadenciaDiasSemana || cadenciaDiasSemana.length === 0) return inicio;

  const dias = ORDEM_DIA_SEMANA.filter((d) => cadenciaDiasSemana.includes(d)).map((d) => DIA_SEMANA_ABREV[d]);
  const diasTexto = dias.length <= 1 ? dias.join("") : `${dias.slice(0, -1).join(", ")} e ${dias[dias.length - 1]}`;

  const fim = formatHorario(horarioFim);
  const horarioTexto = inicio ? (fim ? `${inicio}–${fim}` : inicio) : null;

  return horarioTexto ? `${diasTexto}, ${horarioTexto}` : diasTexto;
}

export function corFrequencia(percentual: number): string {
  if (percentual >= 75) return "text-green-500";
  if (percentual >= 60) return "text-amber-500";
  return "text-red-500";
}

export function corBarraFrequencia(percentual: number): string {
  if (percentual >= 75) return "bg-green-500";
  if (percentual >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export { DIA_SEMANA_EXTENSO };
