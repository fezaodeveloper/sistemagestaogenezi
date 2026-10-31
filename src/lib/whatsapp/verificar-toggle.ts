import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsappNotifChave } from "@/lib/configuracoes/schema";

// Cache em memória com TTL de 1 min — mesmo padrão de
// src/lib/telegram/verificar-toggle.ts — evita uma query ao Supabase
// a cada mensagem enviada em lotes (crons, cobrança em massa, etc.).
let cache: { valores: Record<string, boolean>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function carregarToggleWhatsapp(): Promise<Record<string, boolean>> {
  if (cache && Date.now() < cache.expiresAt) return cache.valores;

  const { data } = await createAdminClient()
    .from("configuracoes")
    .select(
      "wz_matricula_criada, wz_lembrete_aula, wz_falta_aula, wz_dados_acesso, wz_cobranca_gerada, wz_cobranca_atrasada_d1, wz_cobranca_atrasada_d3, wz_cobranca_atrasada_d7, wz_cobranca_atrasada_d15, wz_recontato_lead, wz_followup_lead, wz_agendamento_confirmacao, wz_lembrete_agendamento, wz_agendamento_cancelado, wz_agendamento_falta",
    )
    .eq("id", true)
    .single();

  const valores = (data as Record<string, boolean> | null) ?? {};
  cache = { valores, expiresAt: Date.now() + CACHE_TTL_MS };
  return valores;
}

/**
 * Verifica se uma notificação de WhatsApp está habilitada antes de enviar.
 * Retorna `true` se a chave não existe no banco (padrão seguro: habilitado).
 *
 * Uso:
 * ```ts
 * if (!(await whatsappToggleHabilitado("wz_matricula_criada"))) return;
 * await enviarWhatsApp(telefone, mensagem);
 * ```
 */
export async function whatsappToggleHabilitado(chave: WhatsappNotifChave): Promise<boolean> {
  try {
    const valores = await carregarToggleWhatsapp();
    // Se a coluna não veio no SELECT (ex.: migration ainda não rodou), devolve true
    return chave in valores ? (valores[chave] ?? true) : true;
  } catch {
    // Falha silenciosa: nunca bloqueia o envio por erro de leitura de configuração.
    return true;
  }
}

/** Invalida o cache imediatamente (útil após salvar configurações). */
export function invalidarCacheToggleWhatsapp(): void {
  cache = null;
}
