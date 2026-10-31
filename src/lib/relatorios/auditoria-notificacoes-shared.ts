// Tipos e constantes da auditoria de notificações (TAREFA) compartilhados entre o módulo
// server-only (auditoria-notificacoes.ts, que faz as queries) e o client component
// (automacoes-auditoria-view.tsx). Sem "server-only" de propósito — TIPO_LABELS_AUDITORIA é um
// valor de runtime usado no client (rótulos dos filtros), não só um tipo que o TypeScript
// elimina na compilação.

export const TIPO_LABELS_AUDITORIA: Record<string, string> = {
  matricula_criada: "Matrícula criada",
  lembrete_aula: "Lembrete de aula",
  falta: "Sentimos sua falta",
  lead_recontato: "Recontato de lead",
  agendamento_lembrete: "Lembrete de agendamento",
  cobranca_atrasada: "Cobrança atrasada",
  lead_followup: "Follow-up de lead",
};

export type VisaoGeralAuditoria = {
  totalEnviados30d: number;
  totalErros30d: number;
  percentualSucesso: number;
  alunosSemNotificacao: number;
};

export type AlunoSemLembrete = {
  matriculaId: string;
  alunoNome: string;
  turmaNome: string;
  whatsapp: string | null;
  ultimoEnvio: string | null;
  numeroSuspeito: boolean;
};

export type TurmaOpcao = { id: string; nome: string };

export type AlunoDiagnosticoTurma = {
  matriculaId: string;
  alunoNome: string;
  whatsapp: string | null;
  recebeu: boolean;
  ultimoEnvio: string | null;
  ultimoStatus: "enviado" | "falha" | null;
};

export type HistoricoNotificacao = {
  id: string;
  createdAt: string;
  alunoOuLeadNome: string;
  turmaNome: string | null;
  tipo: string;
  canal: "whatsapp";
  status: "pendente" | "enviado" | "falha";
  erro: string | null;
  enviadoPor: "sistema" | "manual";
};

export type FiltrosHistorico = { tipo?: string; status?: string; turmaId?: string; page: number; limite: number };
