import { z } from "zod";

export const EVENTO_TIPOS = ["aula", "prova", "evento", "outro", "feriado"] as const;
export type EventoTipo = (typeof EVENTO_TIPOS)[number];
export const EVENTO_TIPO_LABELS: Record<EventoTipo, string> = {
  aula: "Aula",
  prova: "Prova",
  evento: "Evento",
  feriado: "Feriado",
  outro: "Outro",
};

// Cor de pílula por tipo, pedida na grade do calendário: feriado=vermelho,
// prova=âmbar, aula=azul, evento=verde, outro=cinza. Mesmo padrão de classe
// fixa usado em MATRICULA_STATUS_BADGE_CLASS (src/lib/matriculas/schema.ts).
export const EVENTO_TIPO_BADGE_CLASS: Record<EventoTipo, string> = {
  feriado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  prova: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  aula: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  evento: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  outro: "bg-gray-500/10 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
};

export const TIPO_FERIADO_OPTIONS = ["nacional", "estadual", "municipal"] as const;
export type TipoFeriado = (typeof TIPO_FERIADO_OPTIONS)[number];
export const TIPO_FERIADO_LABELS: Record<TipoFeriado, string> = {
  nacional: "Nacional",
  estadual: "Estadual",
  municipal: "Municipal",
};

export const ABRANGENCIA_OPTIONS = ["todos", "curso", "turma"] as const;
export type Abrangencia = (typeof ABRANGENCIA_OPTIONS)[number];
export const ABRANGENCIA_LABELS: Record<Abrangencia, string> = {
  todos: "Todos os cursos",
  curso: "Curso específico",
  turma: "Turma específica",
};

export const eventoFormSchema = z
  .object({
    nome: z
      .string({ error: "Informe o nome do evento." })
      .trim()
      .min(1, { error: "Informe o nome do evento." })
      .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
    tipo: z.enum(EVENTO_TIPOS, { error: "Selecione o tipo do evento." }),
    tipo_feriado: z.enum(TIPO_FERIADO_OPTIONS).optional(),
    data_inicio: z.string().min(1, { error: "Informe a data de início." }),
    // Sem data de término informada, o insert assume a mesma data de início
    // (regra da Server Action, não do schema — ver createEvento).
    data_fim: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined)),
    horario_inicio: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined)),
    horario_fim: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined)),
    abrangencia: z.enum(ABRANGENCIA_OPTIONS, { error: "Selecione a abrangência." }),
    curso_id: z.uuid().optional(),
    turma_id: z.uuid().optional(),
    gera_notificacao: z.boolean(),
    impacta_aulas: z.boolean(),
    bloqueia_frequencia: z.boolean(),
    observacoes: z
      .string()
      .trim()
      .max(2000, { error: "Máximo de 2000 caracteres." })
      .optional(),
  })
  .refine((data) => !data.data_fim || data.data_fim >= data.data_inicio, {
    error: "A data de término deve ser igual ou posterior à data de início.",
    path: ["data_fim"],
  })
  .refine((data) => data.tipo !== "feriado" || !!data.tipo_feriado, {
    error: "Selecione o tipo de feriado.",
    path: ["tipo_feriado"],
  })
  .refine((data) => data.abrangencia !== "curso" || !!data.curso_id, {
    error: "Selecione o curso.",
    path: ["curso_id"],
  })
  .refine((data) => data.abrangencia !== "turma" || !!data.turma_id, {
    error: "Selecione a turma.",
    path: ["turma_id"],
  });

export type EventoFormValues = z.infer<typeof eventoFormSchema>;

export type EventoCalendario = {
  id: string;
  nome: string;
  tipo: EventoTipo;
  tipo_feriado: TipoFeriado | null;
  data_inicio: string;
  data_fim: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  curso_id: string | null;
  turma_id: string | null;
  abrangencia: Abrangencia;
  gera_notificacao: boolean;
  impacta_aulas: boolean;
  bloqueia_frequencia: boolean;
  observacoes: string | null;
  origem: "manual" | "api";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EventoCalendarioComRelacoes = EventoCalendario & {
  cursos: { nome: string } | null;
  turmas: { nome: string } | null;
};

// Formato de item da resposta da BrasilAPI
// (https://brasilapi.com.br/api/feriados/v1/{ano}).
export type FeriadoAPI = {
  date: string;
  name: string;
  type: string;
};
