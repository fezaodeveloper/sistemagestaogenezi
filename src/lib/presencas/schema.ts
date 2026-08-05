export const PRESENCA_STATUSES = ["presente", "falta", "justificada", "reposicao"] as const;

export const PRESENCA_STATUS_LABELS: Record<(typeof PRESENCA_STATUSES)[number], string> = {
  presente: "Presente",
  falta: "Falta",
  justificada: "Justificada",
  reposicao: "Reposição",
};

export type Presenca = {
  id: string;
  matricula_id: string;
  aula_id: string;
  data: string;
  status: (typeof PRESENCA_STATUSES)[number];
  created_by: string;
  created_at: string;
  updated_at: string;
};
