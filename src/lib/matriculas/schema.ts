import { z } from "zod";

export const MATRICULA_STATUSES = ["ativa", "concluida", "cancelada", "transferida"] as const;

export const MATRICULA_STATUS_LABELS: Record<(typeof MATRICULA_STATUSES)[number], string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
  transferida: "Transferida",
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
  status: (typeof MATRICULA_STATUSES)[number];
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MatriculaWithTurma = Matricula & { turmas: { nome: string } | null };
