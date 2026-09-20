import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { StripeAdapter, STRIPE_METADATA_REFERENCIA } from "@/lib/gateways/adapters/stripe";
import { carregarConfigGateway } from "@/lib/gateways/config";
import { montarConfigStripe } from "@/lib/gateways/manager";
import {
  anotarFalhaParcela,
  baixarParcelaPaga,
  cancelarParcelaEmAberto,
  primeiroUuid,
  type SupabaseAdmin,
} from "@/lib/gateways/parcelas";
import { GatewayTipo } from "@/lib/gateways/types";

// Webhook do Stripe — mesma lógica do webhook do Asaas (api/webhooks/asaas),
// trocando a chave de ligação: lá a parcela é achada por asaas_payment_id; aqui o
// PaymentIntent leva o id da parcela em metadata.referencia_externa (gravado por
// StripeAdapter.gerarCobranca), então não é preciso coluna nova em `parcelas`. As
// atualizações em si estão em src/lib/gateways/parcelas.ts (compartilhadas com o
// webhook do Pagar.me).
//
// Autenticação: assinatura do Stripe (header "stripe-signature") conferida com o
// webhookSecret salvo em /admin/configuracoes/gateways.
//
// Respostas: 400 = assinatura inválida/webhook não configurado (o Stripe não
// reenvia); 500 = falha ao gravar (o Stripe reenvia por até 3 dias, e cada
// atualização é idempotente); 200 = processado ou evento ignorado.

async function processarEvento(supabase: SupabaseAdmin, adapter: StripeAdapter, evento: Stripe.Event): Promise<string | null> {
  if (
    evento.type !== "payment_intent.succeeded" &&
    evento.type !== "payment_intent.payment_failed" &&
    evento.type !== "payment_intent.canceled"
  ) {
    return null;
  }

  const intent = evento.data.object;
  const parcelaId = primeiroUuid([intent.metadata?.[STRIPE_METADATA_REFERENCIA]]);
  // Cobrança do Stripe que não nasceu de uma parcela (ou de outro sistema na mesma conta).
  if (!parcelaId) return null;

  switch (evento.type) {
    case "payment_intent.succeeded":
      return baixarParcelaPaga(supabase, parcelaId, {
        forma: await adapter.metodoDoPaymentIntent(intent),
        idNotificacao: intent.id,
        gateway: "stripe",
      });
    case "payment_intent.payment_failed":
      return anotarFalhaParcela(
        supabase,
        parcelaId,
        "Stripe",
        intent.last_payment_error?.message ?? intent.last_payment_error?.code ?? "motivo não informado",
      );
    case "payment_intent.canceled":
      return cancelarParcelaEmAberto(supabase, parcelaId, "stripe");
  }
}

export async function POST(request: Request) {
  const assinatura = request.headers.get("stripe-signature");
  if (!assinatura) return new Response("Missing signature", { status: 400 });

  // Corpo BRUTO: a assinatura é calculada sobre os bytes exatos — parsear o JSON antes quebraria.
  const corpo = await request.text();

  const config = await carregarConfigGateway(GatewayTipo.Stripe);
  const adapter = new StripeAdapter(montarConfigStripe(config));

  let evento: Stripe.Event;
  try {
    evento = adapter.verificarWebhook(corpo, assinatura);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const erro = await processarEvento(createAdminClient(), adapter, evento);
  if (erro) {
    console.error(`[stripe-webhook] ${evento.type} (${evento.id}): ${erro}`);
    return new Response("Erro ao processar", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
