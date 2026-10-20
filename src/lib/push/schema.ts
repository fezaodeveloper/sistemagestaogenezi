import { z } from "zod";

export const notificacaoPushSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título.").max(50, "O título pode ter no máximo 50 caracteres."),
  corpo: z
    .string()
    .trim()
    .min(1, "Informe o corpo da mensagem.")
    .max(150, "O corpo pode ter no máximo 150 caracteres."),
  url: z.string().trim().min(1, "Informe a URL de destino."),
});

// ===== Templates (src/app/admin/notificacoes/actions.ts) =====

export const PUSH_TEMPLATE_TIPOS = ["lembrete_pagamento", "lembrete_aula", "recesso", "feriado", "aviso_geral"] as const;
export type PushTemplateTipo = (typeof PUSH_TEMPLATE_TIPOS)[number];

export const PUSH_TEMPLATE_TIPO_LABELS: Record<PushTemplateTipo, string> = {
  lembrete_pagamento: "Lembrete de pagamento",
  lembrete_aula: "Lembrete de aula",
  recesso: "Recesso",
  feriado: "Feriado",
  aviso_geral: "Aviso geral",
};

export const pushTemplateSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(100, "O nome pode ter no máximo 100 caracteres."),
  titulo: z.string().trim().min(1, "Informe o título.").max(50, "O título pode ter no máximo 50 caracteres."),
  corpo: z
    .string()
    .trim()
    .min(1, "Informe o corpo da mensagem.")
    .max(150, "O corpo pode ter no máximo 150 caracteres."),
  tipo: z.enum(PUSH_TEMPLATE_TIPOS, { error: "Selecione o tipo." }),
  ativo: z.boolean(),
});

// ===== Agendamentos (src/app/admin/notificacoes/actions.ts) =====

export const PUSH_AGENDAMENTO_DESTINATARIOS = ["todos", "ativos", "turma"] as const;
export type PushAgendamentoDestinatario = (typeof PUSH_AGENDAMENTO_DESTINATARIOS)[number];

export const PUSH_AGENDAMENTO_DESTINATARIO_LABELS: Record<PushAgendamentoDestinatario, string> = {
  todos: "Todos os alunos",
  ativos: "Alunos ativos",
  turma: "Turma específica",
};

export const pushAgendamentoSchema = z
  .object({
    templateId: z.uuid().nullable(),
    titulo: z.string().trim().min(1, "Informe o título.").max(50, "O título pode ter no máximo 50 caracteres."),
    corpo: z
      .string()
      .trim()
      .min(1, "Informe o corpo da mensagem.")
      .max(150, "O corpo pode ter no máximo 150 caracteres."),
    destinatarios: z.enum(PUSH_AGENDAMENTO_DESTINATARIOS, { error: "Selecione os destinatários." }),
    turmaId: z.uuid().nullable(),
    // "YYYY-MM-DDTHH:mm" — valor cru de <input type="datetime-local">.
    agendadoPara: z
      .string({ error: "Informe a data e a hora do envio." })
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Informe a data e a hora do envio." }),
  })
  .refine((dados) => dados.destinatarios !== "turma" || !!dados.turmaId, {
    error: "Selecione a turma.",
    path: ["turmaId"],
  });
