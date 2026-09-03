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

// agora.getDate()/getHours() etc. usam o fuso do runtime (UTC nas funções
// serverless da Vercel), não o horário de Brasília — por isso o
// Intl.DateTimeFormat abaixo, com timeZone explícito, em vez de ler os
// componentes da data diretamente.
function dataHoraAtual(): string {
  const agora = new Date();
  const formatoBR = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatoBR.format(agora);
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
