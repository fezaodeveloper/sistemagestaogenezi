import { z } from "zod";

export const MENSAGEM_TIPOS = ["matricula_criada", "lembrete_aula", "falta"] as const;
export type MensagemTipo = (typeof MENSAGEM_TIPOS)[number];

export const MENSAGEM_TIPO_LABELS: Record<MensagemTipo, string> = {
  matricula_criada: "Matrícula criada",
  lembrete_aula: "Lembrete de aula",
  falta: "Sentimos sua falta",
};

export const MENSAGEM_STATUSES = ["pendente", "enviado", "falha"] as const;
export type MensagemStatus = (typeof MENSAGEM_STATUSES)[number];

export const MENSAGEM_STATUS_LABELS: Record<MensagemStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  falha: "Falha",
};

// evolution_api_key nunca entra aqui — não tem grant de select pra
// authenticated (ver migration). A tela de configuração só sabe se a
// chave está preenchida ou não via um boolean calculado à parte.
export type WhatsappConfig = {
  id: boolean;
  evolution_api_url: string | null;
  evolution_instance_name: string | null;
  ativo: boolean;
  template_matricula_criada: string;
  template_lembrete_aula: string;
  template_falta: string;
  updated_by: string | null;
  updated_at: string;
};

export type MensagemEnviada = {
  id: string;
  tipo: MensagemTipo;
  matricula_id: string;
  aula_id: string | null;
  telefone_destino: string;
  mensagem_texto: string;
  status: MensagemStatus;
  erro_detalhe: string | null;
  created_at: string;
};

export const whatsappConfigFormSchema = z.object({
  evolution_api_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined),
  evolution_instance_name: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
  // Vazio = "manter a chave atual" (a tela nunca mostra o valor salvo, então
  // não dá pra distinguir "sem chave" de "não mexi no campo" de outro jeito).
  evolution_api_key: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined),
  ativo: z.coerce.boolean().optional().default(false),
  template_matricula_criada: z
    .string({ error: "Informe o texto da mensagem de matrícula criada." })
    .trim()
    .min(1, { error: "Informe o texto da mensagem de matrícula criada." })
    .max(1000),
  template_lembrete_aula: z
    .string({ error: "Informe o texto do lembrete de aula." })
    .trim()
    .min(1, { error: "Informe o texto do lembrete de aula." })
    .max(1000),
  template_falta: z
    .string({ error: "Informe o texto da mensagem de falta." })
    .trim()
    .min(1, { error: "Informe o texto da mensagem de falta." })
    .max(1000),
});

export type WhatsappConfigFormValues = z.infer<typeof whatsappConfigFormSchema>;
