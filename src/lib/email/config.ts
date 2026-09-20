import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";

// Linha única de email_config (o check da migration impede outro id).
export const EMAIL_CONFIG_ID = "00000000-0000-0000-0000-000000000002";

export const PROVEDORES_EMAIL = ["resend", "smtp", "sendgrid"] as const;
export type ProvedorEmail = (typeof PROVEDORES_EMAIL)[number];

export function isProvedorEmail(valor: unknown): valor is ProvedorEmail {
  return typeof valor === "string" && (PROVEDORES_EMAIL as readonly string[]).includes(valor);
}

export type ConfigEmail = {
  provedor: ProvedorEmail;
  // Segredos já descriptografados ("" = não há / ilegível).
  resend: { apiKey: string; fromName: string; fromEmail: string };
  smtp: { host: string; porta: number; usuario: string; senha: string; ssl: boolean; fromName: string; fromEmail: string };
  sendgrid: { apiKey: string; fromName: string; fromEmail: string };
};

type Linha = {
  provedor: string;
  resend_api_key: string | null;
  resend_from_name: string | null;
  resend_from_email: string | null;
  smtp_host: string | null;
  smtp_porta: number | null;
  smtp_usuario: string | null;
  smtp_senha: string | null;
  smtp_ssl: boolean | null;
  smtp_from_name: string | null;
  smtp_from_email: string | null;
  sendgrid_api_key: string | null;
  sendgrid_from_name: string | null;
  sendgrid_from_email: string | null;
};

function segredo(valor: string | null): string {
  if (!valor) return "";
  try {
    return descriptografar(valor);
  } catch {
    // Cifrado com outra chave (ou GATEWAYS_ENCRYPTION_KEY ausente): trata como não preenchido.
    return "";
  }
}

export function paraConfig(linha: Linha): ConfigEmail {
  return {
    provedor: isProvedorEmail(linha.provedor) ? linha.provedor : "resend",
    resend: {
      apiKey: segredo(linha.resend_api_key),
      fromName: linha.resend_from_name ?? "",
      fromEmail: linha.resend_from_email ?? "",
    },
    smtp: {
      host: linha.smtp_host ?? "",
      porta: linha.smtp_porta ?? 587,
      usuario: linha.smtp_usuario ?? "",
      senha: segredo(linha.smtp_senha),
      ssl: linha.smtp_ssl ?? true,
      fromName: linha.smtp_from_name ?? "",
      fromEmail: linha.smtp_from_email ?? "",
    },
    sendgrid: {
      apiKey: segredo(linha.sendgrid_api_key),
      fromName: linha.sendgrid_from_name ?? "",
      fromEmail: linha.sendgrid_from_email ?? "",
    },
  };
}

// Cache curto (30s) só pro caminho quente do envio; a tela lê direto.
const TTL_MS = 30_000;
let cache: { config: ConfigEmail | null; expiraEm: number } | null = null;

export function invalidarCacheEmail(): void {
  cache = null;
}

// Client ADMIN (service_role): o envio roda em webhooks e formulários públicos, sem
// sessão. null = sem linha OU tabela indisponível (migration pendente) — quem envia
// então usa o Resend do ambiente, exatamente como antes desta configuração existir.
export async function carregarConfigEmail(opcoes: { semCache?: boolean } = {}): Promise<ConfigEmail | null> {
  if (!opcoes.semCache && cache && cache.expiraEm > Date.now()) return cache.config;

  let config: ConfigEmail | null = null;
  try {
    const { data, error } = await createAdminClient().from("email_config").select("*").eq("id", EMAIL_CONFIG_ID).maybeSingle();
    if (!error && data) config = paraConfig(data as Linha);
  } catch {
    config = null;
  }
  cache = { config, expiraEm: Date.now() + TTL_MS };
  return config;
}
