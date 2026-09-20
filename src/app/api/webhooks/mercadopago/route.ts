import { createAdminClient } from "@/lib/supabase/admin";
import {
  MercadoPagoAdapter,
  normalizarMetodoMercadoPago,
  type PagamentoMercadoPago,
} from "@/lib/gateways/adapters/mercadopago";
import { carregarConfigGateway } from "@/lib/gateways/config";
import { montarConfigMercadoPago } from "@/lib/gateways/manager";
import {
  anotarFalhaParcela,
  baixarParcelaPaga,
  cancelarParcelaEmAberto,
  estornarParcelaPaga,
  primeiroUuid,
  type SupabaseAdmin,
} from "@/lib/gateways/parcelas";
import { GatewayTipo } from "@/lib/gateways/types";

// Webhook do Mercado Pago — mesma lógica dos webhooks do Stripe/Pagar.me/Asaas: a
// parcela é achada pelo id gravado em external_reference (ver
// MercadoPagoAdapter.gerarCobranca) e atualizada pelos helpers compartilhados de
// src/lib/gateways/parcelas.ts.
//
// O Mercado Pago só avisa "o pagamento X mudou" (POST com type=payment e o id em
// data.id): o status de verdade é lido na API com o Access Token — assim um corpo
// forjado, mesmo que passasse pela assinatura, nunca dita o resultado.
//
// Autenticação: x-signature + x-request-id (HMAC-SHA256 com o webhookSecret).
//
// Respostas: 401 = assinatura ausente/inválida; 500 = falha ao consultar/gravar (o
// Mercado Pago reenvia; tudo aqui é idempotente); 200 = processado ou ignorado.

async function processarPagamento(supabase: SupabaseAdmin, pagamento: PagamentoMercadoPago): Promise<string | null> {
  const parcelaId = primeiroUuid([pagamento.external_reference, pagamento.metadata?.referencia_externa]);
  // Pagamento que não nasceu de uma parcela (ou de outro sistema na mesma conta).
  if (!parcelaId) return null;

  switch (pagamento.status) {
    case "approved":
      return baixarParcelaPaga(supabase, parcelaId, {
        forma: normalizarMetodoMercadoPago(pagamento),
        idNotificacao: String(pagamento.id),
        gateway: "mercadopago",
      });
    case "cancelled":
      return cancelarParcelaEmAberto(supabase, parcelaId, "mercadopago");
    case "refunded":
    case "charged_back":
      return estornarParcelaPaga(supabase, parcelaId);
    case "rejected":
      return anotarFalhaParcela(supabase, parcelaId, "Mercado Pago", pagamento.status_detail ?? "pagamento recusado");
    default:
      // pending, in_process, authorized... ainda sem desfecho.
      return null;
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const xSignature = request.headers.get("x-signature");
  if (!xSignature) return new Response("Missing signature", { status: 401 });

  const config = await carregarConfigGateway(GatewayTipo.Mercadopago);
  const adapter = new MercadoPagoAdapter(montarConfigMercadoPago(config));

  // O id que entra na assinatura é o da QUERY STRING (data.id), não o do corpo.
  const dataIdQuery = url.searchParams.get("data.id");
  const valida = adapter.verificarAssinatura({
    xSignature,
    xRequestId: request.headers.get("x-request-id"),
    dataId: dataIdQuery,
  });
  if (!valida) return new Response("Invalid signature", { status: 401 });

  const corpo = (await request.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;
  const tipo = url.searchParams.get("type") ?? corpo?.type;
  const pagamentoId = dataIdQuery ?? (corpo?.data?.id !== undefined ? String(corpo.data.id) : null);

  // Só interessa "payment" (merchant_order etc. são ignorados).
  if (tipo !== "payment" || !pagamentoId || !/^\d+$/.test(pagamentoId)) {
    return new Response("OK", { status: 200 });
  }

  let pagamento: PagamentoMercadoPago;
  try {
    pagamento = await adapter.consultarPagamento(pagamentoId);
  } catch (erro) {
    // Notificação de teste do painel usa um id fictício (ex.: 123456): não existe.
    if (erro instanceof Error && /not found|não encontrado|404/i.test(erro.message)) {
      return new Response("OK", { status: 200 });
    }
    console.error(`[mercadopago-webhook] falha ao consultar o pagamento ${pagamentoId}`, erro);
    return new Response("Erro ao consultar pagamento", { status: 500 });
  }

  const erro = await processarPagamento(createAdminClient(), pagamento);
  if (erro) {
    console.error(`[mercadopago-webhook] pagamento ${pagamentoId}: ${erro}`);
    return new Response("Erro ao processar", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
