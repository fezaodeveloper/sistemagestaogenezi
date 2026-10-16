import "server-only";

import { enviarMensagemTelegram } from "@/lib/telegram/client";

// Só um fetch simples (enviarMensagemTelegram) por update — mesmo raciocínio do maxDuration
// elevado em /api/webhooks/evolution, só que aqui nem chega a precisar: 30s é folga de sobra.
export const maxDuration = 30;

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
};

function agoraEmBrasiliaTexto(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const MENSAGEM_AJUDA = [
  "🤖 <b>Bot da Gênezi</b>",
  "",
  "Comandos disponíveis:",
  "/status — Verifica se o bot está online",
  "/resumo — Resumo do dia (em breve)",
  "/ajuda — Exibe esta mensagem",
].join("\n");

// Webhook de ENTRADA do bot @genezi_educacao_bot (Fase 3.1) — mesmo padrão de
// src/app/api/webhooks/evolution/route.ts: autentica por header, sempre responde 200 (nunca
// deixa o Telegram reenviar por erro interno/comando inválido/secret errado).
//
// Registrar com setWebhook + secret_token = TELEGRAM_WEBHOOK_SECRET (ver .env.example) — o
// Telegram então manda esse mesmo valor no header "x-telegram-bot-api-secret-token" em toda
// chamada, sem precisar de query string nem path secreto.
//
// Responde SEMPRE no chatId do remetente (message.chat.id), nunca no TELEGRAM_CHAT_ID fixo do
// grupo — funciona tanto em grupo quanto em chat privado com o bot.
export async function POST(request: Request): Promise<Response> {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("OK", { status: 200 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  const chatId = message?.chat?.id;
  const texto = message?.text?.trim();

  if (!chatId || !texto || !texto.startsWith("/")) {
    return new Response("OK", { status: 200 });
  }

  const username = message?.from?.username ?? message?.from?.first_name ?? "usuário";
  console.log(`[telegram:webhook] comando "${texto}" de ${username} (chat ${chatId})`);

  try {
    switch (texto.toLowerCase()) {
      case "/start":
      case "/ajuda":
        await enviarMensagemTelegram(MENSAGEM_AJUDA, String(chatId));
        break;
      case "/status":
        await enviarMensagemTelegram(`✅ <b>Bot online</b>\n🕐 ${agoraEmBrasiliaTexto()}`, String(chatId));
        break;
      case "/resumo":
        // Reservado para a Fase 3.2 — ver padrão de query em src/app/api/cron/*.
        await enviarMensagemTelegram("📊 /resumo em breve.", String(chatId));
        break;
      default:
        await enviarMensagemTelegram("Comando não reconhecido. Use /ajuda.", String(chatId));
    }
  } catch (err) {
    console.error("[telegram:webhook] erro ao processar comando:", err);
  }

  return new Response("OK", { status: 200 });
}
