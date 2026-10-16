"use server";

import { requireRole } from "@/lib/auth/dal";
import { enviarMensagemTelegram } from "@/lib/telegram/client";

export async function testarTelegramAction(): Promise<{
  ok: boolean;
  erro?: string;
}> {
  await requireRole("admin");
  try {
    // enviarMensagemTelegram manda parse_mode "HTML" (ver src/lib/telegram/client.ts) — tags HTML
    // (<b>/<i>), não marcadores de markdown (*bold*/_italic_), senão aparecem literais na mensagem.
    const ok = await enviarMensagemTelegram(
      `🔔 <b>Teste de notificação — SISTEMA DA GÊNEZI</b>\n\nSe você está vendo esta mensagem, as notificações do Telegram estão funcionando corretamente.\n\n<i>Enviado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</i>`,
    );
    if (!ok) return { ok: false, erro: "enviarMensagemTelegram retornou false — verifique TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID." };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
