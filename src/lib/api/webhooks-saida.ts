import "server-only";

// Estrutura pronta pra quando o N8n (ou outro serviço) se conectar via
// webhook trigger — hoje só loga, porque ainda não existe onde registrar
// URLs de webhook de saída (isso é o que POST /api/v1/webhooks/registrar,
// em src/app/api/v1/webhooks/route.ts, vai passar a fazer quando for
// implementado de verdade).
// TODO: quando N8n estiver instalado, buscar as URLs de webhook
// registradas (por evento) e fazer o POST do payload pra cada uma.
export async function notificarWebhooksSaida(
  evento: string,
  payload: Record<string, unknown>,
): Promise<void> {
  console.log(`[webhooks-saida] evento="${evento}"`, payload);
}
