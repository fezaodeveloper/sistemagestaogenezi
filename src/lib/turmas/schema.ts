import { z } from "zod";

export const TURMA_STATUSES = ["planejada", "ativa", "encerrada", "cancelada"] as const;

export const TURMA_STATUS_LABELS: Record<(typeof TURMA_STATUSES)[number], string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

export const DIA_SEMANA_LABELS: Record<(typeof DIAS_SEMANA)[number], string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

export const turmaFormSchema = z
  .object({
    curso_id: z.uuid({ error: "Selecione o curso." }),
    nome: z
      .string({ error: "Informe o nome da turma." })
      .trim()
      .min(1, { error: "Informe o nome da turma." })
      .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
    data_inicio: z.string().min(1, { error: "Informe a data de início." }),
    data_fim: z.string().min(1, { error: "Informe a data de término." }),
    capacidade_maxima: z.coerce
      .number({ error: "Informe a capacidade máxima." })
      .int({ error: "A capacidade deve ser um número inteiro." })
      .positive({ error: "A capacidade deve ser maior que zero." }),
    status: z.enum(TURMA_STATUSES, { error: "Selecione o status da turma." }),
    // Obrigatoriedade condicional a cursos.tipo (turma de curso EAD não usa
    // cadência) não dá pra validar aqui — o schema não tem acesso ao tipo do
    // curso a partir só do curso_id. Essa regra fica na Server Action, que
    // busca cursos.tipo depois de parsear.
    cadencia_dias_semana: z.array(z.enum(DIAS_SEMANA)).optional(),
    // Horário único da aula pra essa turma (ex.: "toda terça e quinta às
    // 19h") — opcional, usado só pra compor {horario_aula} nas mensagens
    // de WhatsApp (Fase 13). Sem validação de obrigatoriedade condicional
    // por tipo de curso — mesmo curso EAD pode ter um horário de encontro
    // ao vivo, por exemplo.
    horario_aula: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((data) => data.data_fim >= data.data_inicio, {
    error: "A data de término deve ser igual ou posterior à data de início.",
    path: ["data_fim"],
  });

export type TurmaFormValues = z.infer<typeof turmaFormSchema>;

export type Turma = {
  id: string;
  curso_id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  capacidade_maxima: number;
  status: (typeof TURMA_STATUSES)[number];
  cadencia_dias_semana: (typeof DIAS_SEMANA)[number][] | null;
  horario_aula: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TurmaWithCurso = Turma & { cursos: { nome: string } | null };
