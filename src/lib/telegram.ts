import "server-only";

import { enviarMensagemTelegram } from "@/lib/telegram/client";

// Ponto de entrada único das notificações de Telegram novas (lembrete D-1 de
// agendamento, cobrança gerada no Asaas, aviso de presença...).
//
// O envio em si (fetch em https://api.telegram.org/bot{TOKEN}/sendMessage com
// parse_mode HTML, TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID do ambiente) já existe
// em src/lib/telegram/client.ts e é o mesmo usado pelo motor de automações —
// por isso isto delega a ele em vez de duplicar o fetch. Nunca lança: token
// ausente ou falha de rede só retornam false (notificação é sempre best-effort
// e não pode derrubar o fluxo que a disparou).
export async function sendTelegram(mensagem: string): Promise<boolean> {
  return enviarMensagemTelegram(mensagem);
}

// parse_mode é HTML: um "<", ">" ou "&" no meio de um nome/título (ex.:
// "Curso <Básico>") faz o Telegram RECUSAR a mensagem inteira (400). Todo
// valor vindo do banco/usuário e interpolado numa mensagem passa por aqui.
export function escapeHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// "R$ 1.234,56"
export function formatarReaisTelegram(valor: unknown): string {
  const numero = typeof valor === "number" ? valor : Number(valor ?? 0);
  return `R$ ${numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "YYYY-MM-DD" -> "DD/MM/AAAA" (sem passar por Date, que aplicaria o fuso).
export function formatarDataTelegram(dataISO: string | null | undefined): string {
  if (!dataISO || dataISO.length < 10) return "—";
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
