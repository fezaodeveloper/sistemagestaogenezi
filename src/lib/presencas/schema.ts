import { z } from "zod";

export const PRESENCA_STATUSES = ["presente", "falta", "justificada", "reposicao"] as const;

export const PRESENCA_STATUS_LABELS: Record<(typeof PRESENCA_STATUSES)[number], string> = {
  presente: "Presente",
  falta: "Falta",
  justificada: "Justificada",
  reposicao: "Reposição",
};

// Um por status: "reposicao" exige data_reposicao, "justificada" exige
// justificativa, os demais não têm campo extra nenhum.
export const presencaRowSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("presente") }),
  z.object({ status: z.literal("falta") }),
  z.object({
    status: z.literal("justificada"),
    justificativa: z
      .string({ error: "Informe a justificativa." })
      .trim()
      .min(1, { error: "Informe a justificativa." })
      .max(1000, { error: "A justificativa pode ter no máximo 1000 caracteres." }),
  }),
  z.object({
    status: z.literal("reposicao"),
    data_reposicao: z
      .string({ error: "Informe a data da reposição." })
      .min(1, { error: "Informe a data da reposição." }),
  }),
]);

export type PresencaRowValues = z.infer<typeof presencaRowSchema>;

export type Presenca = {
  id: string;
  matricula_id: string;
  aula_id: string;
  data: string;
  status: (typeof PRESENCA_STATUSES)[number];
  data_reposicao: string | null;
  justificativa: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
