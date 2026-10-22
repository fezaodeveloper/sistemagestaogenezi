import { z } from "zod";

// Constantes/tipos/schema extraídos de src/app/admin/configuracoes/regras-notificacao-actions.ts:
// um arquivo "use server" só pode exportar async functions (Next.js recusa o build com qualquer
// outro export, ex.: um array ou Record) — erro real encontrado durante `npm run build` nesta
// tarefa. Mesmo padrão já usado no resto do projeto (ex.: cursoGratuitoFormSchema em
// src/lib/cursos/schema.ts, separado de src/app/admin/cursos-gratuitos/actions.ts).

export const REGRA_NOTIFICACAO_TIPOS = ["lembrete_aula", "whatsapp_personalizado", "telegram_personalizado"] as const;
export type RegraNotificacaoTipo = (typeof REGRA_NOTIFICACAO_TIPOS)[number];
export const REGRA_NOTIFICACAO_TIPO_LABELS: Record<RegraNotificacaoTipo, string> = {
  lembrete_aula: "Lembrete de Aula",
  whatsapp_personalizado: "WhatsApp Personalizado",
  telegram_personalizado: "Telegram Personalizado",
};

export const REGRA_NOTIFICACAO_RECORRENCIAS = ["diario", "semanal", "quinzenal", "mensal"] as const;
export type RegraNotificacaoRecorrencia = (typeof REGRA_NOTIFICACAO_RECORRENCIAS)[number];
export const REGRA_NOTIFICACAO_RECORRENCIA_LABELS: Record<RegraNotificacaoRecorrencia, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

export const REGRA_NOTIFICACAO_DESTINOS = ["whatsapp", "telegram", "ambos"] as const;
export type RegraNotificacaoDestino = (typeof REGRA_NOTIFICACAO_DESTINOS)[number];
export const REGRA_NOTIFICACAO_DESTINO_LABELS: Record<RegraNotificacaoDestino, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  ambos: "Ambos",
};

export const DIA_SEMANA_LABELS_REGRA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export type RegraNotificacao = {
  id: string;
  tipo: RegraNotificacaoTipo;
  nome: string;
  ativo: boolean;
  recorrencia: RegraNotificacaoRecorrencia;
  dia_semana: number | null;
  hora_envio: number;
  proxima_execucao: string;
  ultima_execucao: string | null;
  mensagem_template: string | null;
  destino: RegraNotificacaoDestino;
  created_at: string;
  updated_at: string;
};

export const regraNotificacaoFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome da regra." })
    .trim()
    .min(1, { error: "Informe o nome da regra." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  tipo: z.enum(REGRA_NOTIFICACAO_TIPOS, { error: "Selecione o tipo." }),
  destino: z.enum(REGRA_NOTIFICACAO_DESTINOS, { error: "Selecione o destino." }),
  recorrencia: z.enum(REGRA_NOTIFICACAO_RECORRENCIAS, { error: "Selecione a recorrência." }),
  dia_semana: z.coerce.number().int().min(0).max(6).nullable().optional(),
  hora_envio: z.coerce
    .number({ error: "Informe um número válido." })
    .int()
    .min(0, { error: "A hora precisa estar entre 0 e 23." })
    .max(23, { error: "A hora precisa estar entre 0 e 23." }),
  mensagem_template: z
    .string()
    .trim()
    .max(2000, { error: "O template pode ter no máximo 2000 caracteres." })
    .optional(),
  proxima_execucao: z.string().min(1, { error: "Informe a data de início." }),
});

export type RegraNotificacaoFormValues = z.infer<typeof regraNotificacaoFormSchema>;

export type RegraNotificacaoActionResult = { error?: string };

export type HistoricoEnvioLinha = {
  id: string;
  tipo: string;
  destinatario: string;
  status: string;
  created_at: string;
};

export type HistoricoEnvios = {
  ultimos: HistoricoEnvioLinha[];
  contagemPorTipo: Record<string, number>;
  totalHoje: number;
  totalSemana: number;
  totalMes: number;
  duplicatasDetectadas: number;
};
