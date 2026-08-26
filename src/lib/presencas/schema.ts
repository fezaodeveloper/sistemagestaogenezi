import { z } from "zod";

export const PRESENCA_STATUSES = ["presente", "falta", "justificada", "reposicao"] as const;

export const PRESENCA_STATUS_LABELS: Record<(typeof PRESENCA_STATUSES)[number], string> = {
  presente: "Presente",
  falta: "Falta",
  justificada: "Justificada",
  reposicao: "Reposição",
};

// Mesmo padrão de cores fixas via className usado em TURMA_STATUS_BADGE_CLASS
// (src/lib/turmas/schema.ts) e afins: verde=presente, vermelho=falta,
// âmbar=justificada, azul=reposição.
export const PRESENCA_STATUS_BADGE_CLASS: Record<(typeof PRESENCA_STATUSES)[number], string> = {
  presente: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falta: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  justificada: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  reposicao: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
};

// Frequência mínima pra aptidão ao certificado (mesmo percentual usado em
// avaliar_certificado() no banco — certificado_frequencia_minima_percentual,
// configurável em /admin/configuracoes) — compartilhada entre o relatório da
// turma (turma-detalhes.tsx) e o histórico individual (historico-presencas.tsx).
// Fixa aqui: esses resumos são uma visão rápida, não recalculam a regra de
// emissão de certificado.
export const FREQUENCIA_MINIMA_PERCENTUAL = 75;

export const FREQUENCIA_STATUS_BADGE_CLASS = {
  apto: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inapto: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
} as const;

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
