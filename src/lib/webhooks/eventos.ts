// Eventos disponíveis nos webhooks de saída. Sem dependência de servidor — a tela
// (client) e o disparador (server) usam a mesma lista.

export const WEBHOOK_EVENTOS = [
  "pedido_pendente",
  "pedido_pago",
  "acesso_enviado",
  "pagamento_recusado",
  "pedido_cancelado",
  "matricula_criada",
  "agendamento_criado",
  "lead_criado",
] as const;

export type WebhookEvento = (typeof WEBHOOK_EVENTOS)[number];

export const WEBHOOK_EVENTO_LABELS: Record<WebhookEvento, string> = {
  pedido_pendente: "Pedido pendente",
  pedido_pago: "Pedido pago",
  acesso_enviado: "Acesso enviado",
  pagamento_recusado: "Pagamento recusado",
  pedido_cancelado: "Pedido cancelado",
  matricula_criada: "Matrícula criada",
  agendamento_criado: "Agendamento criado",
  lead_criado: "Lead criado",
};

export const WEBHOOK_EVENTO_DESCRICOES: Record<WebhookEvento, string> = {
  pedido_pendente: "Uma cobrança foi gerada e aguarda pagamento.",
  pedido_pago: "Uma parcela foi paga (qualquer gateway).",
  acesso_enviado: "Os dados de acesso à plataforma foram enviados ao aluno.",
  pagamento_recusado: "Uma tentativa de pagamento foi recusada.",
  pedido_cancelado: "Uma cobrança/parcela foi cancelada.",
  matricula_criada: "Um aluno foi matriculado em uma turma.",
  agendamento_criado: "Alguém agendou uma visita pela página pública.",
  lead_criado: "Um novo lead entrou no CRM.",
};

export function isWebhookEvento(valor: unknown): valor is WebhookEvento {
  return typeof valor === "string" && (WEBHOOK_EVENTOS as readonly string[]).includes(valor);
}

// Validação da URL de destino (uso no cadastro e, de novo, no momento do envio).
// Só http/https e nunca um endereço interno — sem isto o servidor poderia ser
// usado pra alcançar serviços da rede privada (SSRF). É uma checagem por NOME do
// host (não resolve DNS).
export function validarUrlWebhook(bruta: string): { ok: true; url: string } | { ok: false; erro: string } {
  let url: URL;
  try {
    url = new URL(bruta.trim());
  } catch {
    return { ok: false, erro: "URL inválida." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, erro: "A URL deve começar com http:// ou https://." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const interno =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "::" ||
    /^(127|10|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe80:/.test(host);
  if (interno) return { ok: false, erro: "A URL não pode apontar para um endereço interno ou local." };
  return { ok: true, url: url.toString() };
}
