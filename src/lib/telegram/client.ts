import "server-only";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

// Cliente do bot @genezi_educacao_bot — usado pelo motor de automações
// (src/lib/automacoes/motor.ts) pra notificar o grupo do Telegram. Nunca
// lança exceção: falha de rede ou token ausente só retorna false, porque
// notificação é sempre um efeito colateral best-effort, nunca deve derrubar
// o fluxo principal que a disparou.
export async function enviarMensagemTelegram(mensagem: string, chatId?: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId ?? TELEGRAM_CHAT_ID,
        text: mensagem,
        parse_mode: "HTML",
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function dataHoraAtual(): string {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${agora.getFullYear()} ${hora}:${minuto}`;
}

// Formato padronizado de alerta pontual (um evento) — usado pelos handlers
// em src/lib/automacoes/handlers/telegram.ts. Resumo diário e relatório
// semanal têm layout próprio demais pra esse padrão e chamam
// enviarMensagemTelegram diretamente.
export async function enviarAlertaTelegram(
  titulo: string,
  linhas: string[],
  emoji = "🔔",
): Promise<boolean> {
  const mensagem = [`${emoji} <b>GÊNEZI — ${titulo}</b>`, ...linhas, "", `🕐 ${dataHoraAtual()}`].join("\n");
  return enviarMensagemTelegram(mensagem);
}
