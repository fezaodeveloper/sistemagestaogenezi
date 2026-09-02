export const EVENTO_AUTOMACAO_STATUSES = [
  "pendente",
  "processando",
  "concluido",
  "falhou",
  "ignorado",
] as const;
export type EventoAutomacaoStatus = (typeof EVENTO_AUTOMACAO_STATUSES)[number];

export const EVENTO_AUTOMACAO_STATUS_LABELS: Record<EventoAutomacaoStatus, string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluido: "Concluído",
  falhou: "Falhou",
  ignorado: "Ignorado",
};

// Mesmo padrão de cores fixas via className usado em PARCELA_STATUS_BADGE_CLASS
// (src/lib/financeiro/schema.ts) e afins.
export const EVENTO_AUTOMACAO_STATUS_BADGE_CLASS: Record<EventoAutomacaoStatus, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  processando: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  concluido: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falhou: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  ignorado: "bg-muted text-muted-foreground",
};

export const EVENTO_AUTOMACAO_TIPOS = [
  "pagamento.recebido",
  "pagamento.atrasado",
  "matricula.criada",
  "certificado.emitido",
  "lead.novo",
  "aluno.login",
  "aula.concluida",
  "curso.concluido",
  "evasao.risco",
  "erro.sistema",
  "resumo.diario",
  "relatorio.semanal",
  "whatsapp.stub",
  "premio.estoque_baixo",
  "turma.baixa_frequencia",
] as const;
export type EventoAutomacaoTipo = (typeof EVENTO_AUTOMACAO_TIPOS)[number];

export type EventoAutomacao = {
  id: string;
  tipo: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: EventoAutomacaoStatus;
  tentativas: number;
  max_tentativas: number;
  erro: string | null;
  processado_em: string | null;
  created_at: string;
  updated_at: string;
};
