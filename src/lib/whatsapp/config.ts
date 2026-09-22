import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";

// GênZap: conexão com a Evolution API. Reaproveita a tabela `whatsapp_config` que já existe
// (singleton, id boolean — ver a migration) — também usada pelo sistema de templates em
// src/lib/mensagens/. `ativo` é o mesmo interruptor mestre dos dois sistemas.

export const WHATSAPP_STATUSES = ["desconectado", "aguardando_qr", "conectado"] as const;
export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

export function isWhatsappStatus(valor: unknown): valor is WhatsappStatus {
  return typeof valor === "string" && (WHATSAPP_STATUSES as readonly string[]).includes(valor);
}

// Dados pra chamar a Evolution API (instância).
export type EvolutionInstanceConfig = { url: string; instancia: string; apiKey: string };

export type ConfigWhatsapp = {
  ativo: boolean;
  status: WhatsappStatus;
  numeroConectado: string | null;
  delayMinSegundos: number;
  delayMaxSegundos: number;
  // null = URL/instância/chave incompletas — nenhuma chamada à Evolution API é possível ainda.
  evolution: EvolutionInstanceConfig | null;
};

// Client ADMIN (service_role): evolution_api_key não tem grant de select pra authenticated (a
// tela de configuração nunca lê o valor salvo de volta) — mesmo motivo de carregarConfigSms em
// src/lib/integrax/config.ts. Nunca lança: tabela ausente/erro = config "vazia" (tudo
// desconectado/desativado), pra nunca quebrar quem chama.
export async function carregarConfigWhatsapp(): Promise<ConfigWhatsapp> {
  const vazio: ConfigWhatsapp = {
    ativo: false,
    status: "desconectado",
    numeroConectado: null,
    delayMinSegundos: 3,
    delayMaxSegundos: 8,
    evolution: null,
  };

  try {
    const { data, error } = await createAdminClient()
      .from("whatsapp_config")
      .select(
        "ativo, status, numero_conectado, delay_min_segundos, delay_max_segundos, evolution_api_url, evolution_instance_name, evolution_api_key",
      )
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return vazio;

    let apiKey: string | null = null;
    if (typeof data.evolution_api_key === "string" && data.evolution_api_key) {
      try {
        apiKey = descriptografar(data.evolution_api_key);
      } catch {
        apiKey = null;
      }
    }

    const url = (data.evolution_api_url as string | null)?.trim() || null;
    const instancia = (data.evolution_instance_name as string | null)?.trim() || null;

    return {
      ativo: data.ativo === true,
      status: isWhatsappStatus(data.status) ? data.status : "desconectado",
      numeroConectado: (data.numero_conectado as string | null) ?? null,
      delayMinSegundos: Number(data.delay_min_segundos) || 3,
      delayMaxSegundos: Number(data.delay_max_segundos) || 8,
      evolution: url && instancia && apiKey ? { url, instancia, apiKey } : null,
    };
  } catch {
    return vazio;
  }
}

// evolution_api_key não tem select pra authenticated — a tela só sabe se está "configurada"
// (boolean), nunca o valor. Reaproveita o mesmo helper já usado por src/lib/mensagens (mesma
// coluna, mesma regra).
export { getChaveEvolutionConfigurada } from "@/lib/mensagens/mensagens";
