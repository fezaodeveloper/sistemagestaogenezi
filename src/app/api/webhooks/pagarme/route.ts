import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarMetodoPagarme, PagarmeAdapter, PAGARME_METADATA_REFERENCIA } from "@/lib/gateways/adapters/pagarme";
import { carregarConfigGateway } from "@/lib/gateways/config";
import { montarConfigPagarme } from "@/lib/gateways/manager";
import {
  anotarFalhaParcela,
  baixarParcelaPaga,
  cancelarParcelaEmAberto,
  estornarParcelaPaga,
  primeiroUuid,
  type SupabaseAdmin,
} from "@/lib/gateways/parcelas";
import { GatewayTipo } from "@/lib/gateways/types";

// Webhook do Pagar.me — mesma lógica do webhook do Stripe (api/webhooks/stripe) e
// do Asaas: a parcela é achada pelo id gravado no pedido (code/metadata
// "referencia_externa", ver PagarmeAdapter.gerarCobranca) e atualizada pelos
// helpers compartilhados de src/lib/gateways/parcelas.ts.
//
// Autenticação: header X-Hub-Signature = HMAC do corpo bruto com a Secret Key.
//
// Respostas: 401 = assinatura ausente/inválida; 500 = falha ao gravar (o Pagar.me
// reenvia, e cada atualização é idempotente); 200 = processado ou evento ignorado.

type EventoPagarme = {
  id?: string;
  type?: string;
  data?: {
    id?: string;
    code?: string;
    payment_method?: string;
    metadata?: Record<string, unknown> | null;
    order?: { id?: string; code?: string; metadata?: Record<string, unknown> | null } | null;
    last_transaction?: {
      gateway_response?: { errors?: { message?: string }[] } | null;
      acquirer_message?: string | null;
      status?: string;
    } | null;
  };
};

async function processarEvento(supabase: SupabaseAdmin, evento: EventoPagarme): Promise<string | null> {
  const tipo = evento.type;
  const cobranca = evento.data;
  if (!tipo || !cobranca) return null;

  const eventosTratados = ["charge.paid", "charge.canceled", "charge.payment_failed", "charge.failed", "charge.refunded"];
  if (!eventosTratados.includes(tipo)) return null;

  // Onde a referência aparece depende do payload: metadata da cobrança, do pedido,
  // ou o `code` (que é o id da parcela, por construção).
  const parcelaId = primeiroUuid([
    cobranca.metadata?.[PAGARME_METADATA_REFERENCIA],
    cobranca.order?.metadata?.[PAGARME_METADATA_REFERENCIA],
    cobranca.order?.code,
    cobranca.code,
  ]);
  // Cobrança do Pagar.me que não nasceu de uma parcela.
  if (!parcelaId) return null;

  switch (tipo) {
    case "charge.paid":
      return baixarParcelaPaga(supabase, parcelaId, {
        forma: normalizarMetodoPagarme(cobranca.payment_method),
        idNotificacao: cobranca.id ?? parcelaId,
        gateway: "pagarme",
      });
    case "charge.canceled":
      return cancelarParcelaEmAberto(supabase, parcelaId, "pagarme");
    case "charge.refunded":
      return estornarParcelaPaga(supabase, parcelaId);
    default: {
      // charge.payment_failed (nome oficial) e charge.failed.
      const transacao = cobranca.last_transaction;
      const motivo =
        transacao?.gateway_response?.errors?.[0]?.message ?? transacao?.acquirer_message ?? transacao?.status ?? "motivo não informado";
      return anotarFalhaParcela(supabase, parcelaId, "Pagar.me", motivo);
    }
  }
}

export async function POST(request: Request) {
  const assinatura = request.headers.get("x-hub-signature");
  if (!assinatura) return new Response("Missing signature", { status: 401 });

  // Corpo BRUTO: a assinatura é calculada sobre os bytes exatos.
  const corpo = await request.text();

  const config = await carregarConfigGateway(GatewayTipo.Pagarme);
  const adapter = new PagarmeAdapter(montarConfigPagarme(config));
  if (!adapter.verificarAssinatura(corpo, assinatura)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let evento: EventoPagarme;
  try {
    evento = JSON.parse(corpo) as EventoPagarme;
  } catch {
    return new Response("OK", { status: 200 });
  }

  const erro = await processarEvento(createAdminClient(), evento);
  if (erro) {
    console.error(`[pagarme-webhook] ${evento.type} (${evento.id}): ${erro}`);
    return new Response("Erro ao processar", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
