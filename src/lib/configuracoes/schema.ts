import { z } from "zod";
import { onlyDigits } from "@/lib/alunos/schema";

// Mesma técnica de replace sucessivo de formatCpf/formatTelefone
// (src/lib/alunos/schema.ts) — só que pro formato 00.000.000/0000-00.
export function formatCnpj(value: string): string {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

const cnpjSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 14, { error: "CNPJ deve ter 14 dígitos." });

// Mesmo critério de cepSchema em src/lib/alunos/schema.ts (não exportado
// de lá, então reimplementado aqui pro domínio de configurações).
const cepSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((value) => value.length === 8, { error: "CEP deve ter 8 dígitos." });

export const escolaFormSchema = z.object({
  escola_nome: z
    .string({ error: "Informe o nome da escola." })
    .trim()
    .min(1, { error: "Informe o nome da escola." })
    .max(200, { error: "Nome muito longo." }),
  escola_cnpj: cnpjSchema.optional(),
  escola_telefone: z.string().trim().max(20, { error: "Telefone muito longo." }).optional(),
  escola_email: z.email({ error: "E-mail inválido." }).optional(),
  escola_site: z.string().trim().max(200, { error: "Site muito longo." }).optional(),
  escola_endereco: z.string().trim().max(300, { error: "Endereço muito longo." }).optional(),
  escola_cep: cepSchema.optional(),
  escola_cidade: z.string().trim().max(200, { error: "Cidade muito longa." }).optional(),
  escola_estado: z.string().trim().max(2, { error: "Use a sigla do estado (2 letras)." }).optional(),
});

export type EscolaFormValues = z.infer<typeof escolaFormSchema>;

export type ConfiguracoesEscola = {
  escola_nome: string | null;
  escola_cnpj: string | null;
  escola_telefone: string | null;
  escola_email: string | null;
  escola_endereco: string | null;
  escola_cidade: string | null;
  escola_estado: string | null;
  escola_cep: string | null;
  escola_site: string | null;
};

export type ConfiguracoesNotificacoes = {
  notif_financeiro_atrasado: boolean;
  notif_certificados_pendentes: boolean;
  notif_eventos_hoje: boolean;
  notif_eventos_amanha: boolean;
};

// Toggles de notificações do Telegram (aba Configurações > Notificações) — cada chave liga/
// desliga um alerta específico enviado por enviarAlertaTelegram/sendTelegram
// (src/lib/telegram/client.ts, src/lib/telegram.ts). TELEGRAM_NOTIF_CHAVES abaixo é a lista
// dessas chaves, reaproveitada pelo SELECT da página e por verificar-toggle.ts.
export const TELEGRAM_NOTIF_CHAVES = [
  // Financeiro
  "tg_matricula_criada",
  "tg_pagamento_confirmado",
  "tg_pagamento_atrasado",
  "tg_cobranca_gerada",
  "tg_resumo_financeiro_diario",
  // Alunos / LMS
  "tg_curso_concluido",
  "tg_certificado_gerado",
  "tg_aluno_sem_acesso",
  "tg_nota_reprovacao",
  "tg_frequencia_baixa",
  // Leads / CRM
  "tg_lead_criado",
  "tg_lead_convertido",
  "tg_lead_sem_followup",
  // Prêmios
  "tg_premio_resgatado",
  "tg_estoque_baixo",
  // Agendamentos
  "tg_agendamento_criado",
  "tg_agendamento_cancelado",
  "tg_lembrete_agendamento",
  // Relatórios
  "tg_relatorio_frequencia",
  "tg_relatorio_semanal",
  // Gênezi Conecta
  "tg_conecta_nova_postagem",
  "tg_conecta_novo_comentario",
] as const;

export type TelegramNotifChave = (typeof TELEGRAM_NOTIF_CHAVES)[number];

export type TelegramNotifConfig = Record<TelegramNotifChave, boolean>;

// Toggles de notificações do WhatsApp (GênZap) — cada chave liga/desliga
// uma automação específica de envio de mensagem via Evolution API.
// WHATSAPP_NOTIF_CHAVES é reaproveitada pelo SELECT da página e pelo
// verificador de toggle (src/lib/whatsapp/verificar-toggle.ts).
export const WHATSAPP_NOTIF_CHAVES = [
  // Alunos / LMS
  "wz_matricula_criada",
  "wz_lembrete_aula",
  "wz_falta_aula",
  "wz_dados_acesso",
  // Financeiro
  "wz_cobranca_gerada",
  "wz_cobranca_atrasada_d1",
  "wz_cobranca_atrasada_d3",
  "wz_cobranca_atrasada_d7",
  "wz_cobranca_atrasada_d15",
  // Leads / CRM
  "wz_recontato_lead",
  "wz_followup_lead",
  // Agendamentos
  "wz_lembrete_agendamento",
  "wz_agendamento_cancelado",
  "wz_agendamento_falta",
] as const;

export type WhatsappNotifChave = (typeof WHATSAPP_NOTIF_CHAVES)[number];

export type WhatsappNotifConfig = Record<WhatsappNotifChave, boolean>;
