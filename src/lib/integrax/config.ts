import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";

// Linha única de integracoes_sms_config (o check da migration impede outro id).
export const INTEGRAX_CONFIG_ID = "00000000-0000-0000-0000-000000000001";

export type ConfigSms = {
  // Já descriptografado; null = sem token (ou ilegível: chave de criptografia trocada).
  token: string | null;
  ativo: boolean;
};

// Client ADMIN (service_role): o envio roda em webhooks de gateway e formulários
// públicos, sem sessão. Nunca lança — tabela ausente/erro = "não configurado".
export async function carregarConfigSms(): Promise<ConfigSms> {
  try {
    const { data, error } = await createAdminClient()
      .from("integracoes_sms_config")
      .select("token, ativo")
      .eq("id", INTEGRAX_CONFIG_ID)
      .maybeSingle();
    if (error || !data) return { token: null, ativo: false };

    let token: string | null = null;
    if (typeof data.token === "string" && data.token) {
      try {
        token = descriptografar(data.token);
      } catch {
        token = null;
      }
    }
    return { token, ativo: data.ativo === true };
  } catch {
    return { token: null, ativo: false };
  }
}
