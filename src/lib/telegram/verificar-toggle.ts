import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { TELEGRAM_NOTIF_CHAVES, type TelegramNotifChave, type TelegramNotifConfig } from "@/lib/configuracoes/schema";

// Infraestrutura pra uma próxima etapa — ainda NÃO chamada por nenhum handler de automação
// (ver src/lib/automacoes/handlers/*). Vai permitir checar, antes de cada enviarAlertaTelegram/
// sendTelegram, se aquela notificação específica está habilitada (aba Configurações >
// Notificações > Notificações do Telegram).
//
// Client admin (service_role), não o client de sessão: automações rodam em cron/webhook, sem
// request autenticada de admin — mesmo client usado pelo proxy pra checar conecta_habilitado
// (ver src/proxy.ts).
let cache: { data: TelegramNotifConfig; ts: number } | null = null;
const TTL_MS = 60_000;

async function lerConfig(): Promise<TelegramNotifConfig> {
  const agora = Date.now();
  if (cache && agora - cache.ts < TTL_MS) {
    return cache.data;
  }

  const admin = createAdminClient();
  const { data } = await admin.from("configuracoes").select(TELEGRAM_NOTIF_CHAVES.join(", ")).eq("id", true).single();

  // Falha de leitura (tabela de config indisponível, etc.) não deve silenciar notificações que
  // já funcionavam antes desta feature existir — cai pro default "habilitado".
  const config = Object.fromEntries(
    TELEGRAM_NOTIF_CHAVES.map((chave) => [chave, (data as Record<string, boolean> | null)?.[chave] ?? true]),
  ) as TelegramNotifConfig;

  cache = { data: config, ts: agora };
  return config;
}

export async function telegramNotifHabilitada(chave: TelegramNotifChave): Promise<boolean> {
  const config = await lerConfig();
  return config[chave];
}
