import { z } from "zod";

// Enum real do banco (matricula_status): 'transferida' segue existindo por
// causa de dados históricos (ver 20260908300000_matricula_status_enum.sql),
// mesmo não sendo mais oferecida como opção nova — no código ela é tratada
// como um alias visual de 'inativa' (mesma cor/estilo).
export const MATRICULA_STATUSES = [
  "ativa",
  "inativa",
  "concluida",
  "cancelada",
  "transferida",
] as const;

export const MATRICULA_STATUS_LABELS: Record<(typeof MATRICULA_STATUSES)[number], string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
  transferida: "Transferida",
};

// Mesmo padrão de cores fixas via className usado em STATUS_ALUNO_BADGE_CLASS
// (src/lib/alunos/schema.ts) e CURSO_STATUS_BADGE_CLASS (src/lib/cursos/schema.ts).
// 'transferida' usa o mesmo amarelo de 'inativa' (alias visual).
export const MATRICULA_STATUS_BADGE_CLASS: Record<(typeof MATRICULA_STATUSES)[number], string> = {
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  concluida: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  inativa: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  transferida: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  cancelada: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export const matriculaFormSchema = z.object({
  turma_id: z.uuid({ error: "Selecione a turma." }),
  data_matricula: z.string().min(1, { error: "Informe a data da matrícula." }),
});

export type MatriculaFormValues = z.infer<typeof matriculaFormSchema>;

export type Matricula = {
  id: string;
  aluno_id: string;
  turma_id: string;
  data_matricula: string;
  data_expiracao: string;
  status: (typeof MATRICULA_STATUSES)[number];
  valor_final: number | null;
  num_parcelas: number | null;
  valor_parcela: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MatriculaWithTurma = Matricula & { turmas: { nome: string } | null };
