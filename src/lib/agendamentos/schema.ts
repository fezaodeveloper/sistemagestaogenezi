import { z } from "zod";

export const AGENDAMENTO_PAGINA_STATUSES = ["ativa", "inativa"] as const;
export type AgendamentoPaginaStatus = (typeof AGENDAMENTO_PAGINA_STATUSES)[number];

// Quantos dias à frente a página pública mostra/calcula disponibilidade
// (contagem de vagas ocupadas). Compartilhado entre o Server Component
// (/agendar/[slug]) e o calendário do client, que não deixa navegar além disso.
export const AGENDAMENTO_JANELA_DIAS = 90;

export const AGENDAMENTO_STATUSES = ["confirmado", "cancelado", "realizado", "faltou"] as const;
export type AgendamentoStatus = (typeof AGENDAMENTO_STATUSES)[number];

export const AGENDAMENTO_STATUS_LABELS: Record<AgendamentoStatus, string> = {
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  realizado: "Realizado",
  faltou: "Faltou",
};

// Mesmo padrão de cores fixas via className usado em MATRICULA_STATUS_BADGE_CLASS.
export const AGENDAMENTO_STATUS_BADGE_CLASS: Record<AgendamentoStatus, string> = {
  confirmado: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  realizado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  faltou: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  cancelado: "bg-muted text-muted-foreground",
};

// 0 = domingo, 6 = sábado — mesma convenção do Date.prototype.getDay().
export const DIA_SEMANA_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const horarioDisponivelSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  horario: z.string().regex(HORARIO_REGEX, { error: "Horário inválido (use HH:MM)." }),
});
export type HorarioDisponivel = z.infer<typeof horarioDisponivelSchema>;

export const CAMPO_EXTRA_TIPOS = ["texto", "select"] as const;
export type CampoExtraTipo = (typeof CAMPO_EXTRA_TIPOS)[number];

export const campoExtraSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  tipo: z.enum(CAMPO_EXTRA_TIPOS),
  opcoes: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
});
export type CampoExtra = z.infer<typeof campoExtraSchema>;

export const agendamentoPaginaFormSchema = z
  .object({
    titulo: z
      .string({ error: "Informe o título." })
      .trim()
      .min(1, { error: "Informe o título." })
      .max(200, { error: "Máximo de 200 caracteres." }),
    slug: z
      .string({ error: "Informe o slug." })
      .trim()
      .min(1, { error: "Informe o slug." })
      .max(100)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
        error: "Use apenas letras minúsculas, números e hífens (ex: visita-marco).",
      }),
    descricao: z.string().trim().max(2000).optional(),
    cor_primaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." }),
    data_inicio: z.string().trim().optional(),
    data_fim: z.string().trim().optional(),
    vagas_por_horario: z.coerce
      .number({ error: "Informe um número." })
      .int()
      .positive({ error: "Precisa ser maior que zero." }),
    duracao_minutos: z.coerce
      .number({ error: "Informe um número." })
      .int()
      .positive({ error: "Precisa ser maior que zero." }),
    dias_antecedencia_minimo: z.coerce.number({ error: "Informe um número." }).int().nonnegative(),
    mensagem_confirmacao: z.string().trim().max(1000).optional(),
    horarios_disponiveis: z.array(horarioDisponivelSchema).max(200).default([]),
    campos_extras: z.array(campoExtraSchema).max(20).default([]),
  })
  .refine((data) => !data.data_fim || !data.data_inicio || data.data_fim >= data.data_inicio, {
    error: "A data de término deve ser igual ou posterior à data de início.",
    path: ["data_fim"],
  });

export type AgendamentoPaginaFormValues = z.infer<typeof agendamentoPaginaFormSchema>;

export type AgendamentoPagina = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  cor_primaria: string;
  logo_url: string | null;
  status: AgendamentoPaginaStatus;
  data_inicio: string | null;
  data_fim: string | null;
  vagas_por_horario: number;
  duracao_minutos: number;
  horarios_disponiveis: HorarioDisponivel[];
  dias_antecedencia_minimo: number;
  campos_extras: CampoExtra[];
  mensagem_confirmacao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Agendamento = {
  id: string;
  pagina_id: string;
  nome: string;
  whatsapp: string;
  data_agendada: string;
  horario: string;
  campos_extras: Record<string, string>;
  status: AgendamentoStatus;
  // Recado opcional do visitante (coluna nova; ausente antes da migration).
  mensagem?: string | null;
  whatsapp_enviado: boolean;
  lembrete_enviado: boolean;
  created_at: string;
};

// Schema do formulário público (/agendar/[slug]) — "aceite_whatsapp" não tem
// coluna própria na migration (só as 6 colunas do INSERT abaixo existem em
// `agendamentos`), então é validado aqui como obrigatório mas nunca persiste.
export const agendamentoPublicoSchema = z.object({
  nome: z
    .string({ error: "Informe seu nome." })
    .trim()
    .min(1, { error: "Informe seu nome." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  whatsapp: z
    .string({ error: "Informe seu WhatsApp." })
    .trim()
    .min(8, { error: "Informe um WhatsApp válido." })
    .max(30)
    // DDD + número: pelo menos 10 dígitos (mesma regra do formulário).
    .refine((valor) => valor.replace(/\D/g, "").length >= 10, { error: "Informe um WhatsApp válido, com DDD." }),
  data_agendada: z.string({ error: "Selecione uma data." }).trim().min(1, { error: "Selecione uma data." }),
  horario: z.string({ error: "Selecione um horário." }).trim().min(1, { error: "Selecione um horário." }),
  campos_extras: z.record(z.string(), z.string()).optional(),
  mensagem: z.string().trim().max(500, { error: "A mensagem pode ter no máximo 500 caracteres." }).optional(),
  aceite_whatsapp: z.literal(true, { error: "É preciso concordar em receber mensagens pelo WhatsApp." }),
});
export type AgendamentoPublicoValues = z.infer<typeof agendamentoPublicoSchema>;
