import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EFI_INFO_REFERENCIA, EfiAdapter, tokenWebhookEfi, type NotificacaoEfi } from "@/lib/gateways/adapters/efi";
import { carregarConfigGateway } from "@/lib/gateways/config";
import { montarConfigEfi } from "@/lib/gateways/manager";
import {
  anotarFalhaParcela,
  baixarParcelaPaga,
  cancelarParcelaEmAberto,
  estornarParcelaPaga,
  primeiroUuid,
  type SupabaseAdmin,
} from "@/lib/gateways/parcelas";
import { GatewayTipo } from "@/lib/gateways/types";

// Webhook da Efí — recebe DOIS tipos de aviso, no mesmo endpoint:
//
//  1. PIX recebido (API Pix): POST JSON { pix: [{ endToEndId, txid, valor, ... }] }.
//  2. Boleto/cartão (API Cobranças): POST form com um único campo "notification"
//     (token); os detalhes vêm de GET /v1/notification/:token.
//
// Autenticação. A Efí valida webhooks Pix por mTLS (o servidor de quem recebe
// precisa exigir o certificado da Efí no handshake TLS) — isso não é possível na
// Vercel, onde o TLS termina antes do código. Por isso o webhook é cadastrado com o
// header x-skip-mtls-checking (feito por EfiAdapter.registrarWebhookPix, ao salvar
// o gateway) e este endpoint se protege de duas formas:
//  - token secreto na URL (?token=...), derivado do clientSecret;
//  - NUNCA confia no corpo: cada aviso é reconsultado na API da Efí (cobrança PIX
//    CONCLUIDA / eventos da notificação) antes de mexer na parcela.
//
// Respostas: 401 = token ausente/inválido; 500 = falha ao consultar/gravar (a Efí
// reenvia até 9 vezes; tudo aqui é idempotente); 200 = processado ou ignorado.

function tokenValido(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function processarPix(supabase: SupabaseAdmin, adapter: EfiAdapter, txid: string): Promise<string | null> {
  // Fonte da verdade: a cobrança na Efí, não o que veio no corpo do webhook.
  const cob = await adapter.consultarCobPix(txid);
  if (cob.status !== "CONCLUIDA") return null;

  const parcelaId = primeiroUuid([cob.infoAdicionais?.find((info) => info.nome === EFI_INFO_REFERENCIA)?.valor]);
  // Cobrança PIX que não nasceu de uma parcela.
  if (!parcelaId) return null;

  return baixarParcelaPaga(supabase, parcelaId, { forma: "pix", idNotificacao: txid, gateway: "efi" });
}

async function processarNotificacao(supabase: SupabaseAdmin, adapter: EfiAdapter, token: string): Promise<string | null> {
  const eventos = await adapter.consultarNotificacao(token);

  // O que vale é o ÚLTIMO estado de cada cobrança (a lista vem em ordem cronológica).
  const ultimoPorCobranca = new Map<string, NotificacaoEfi>();
  for (const evento of eventos) {
    if (evento.type && evento.type !== "charge") continue;
    const chave = String(evento.identifiers?.charge_id ?? evento.custom_id ?? "");
    if (chave) ultimoPorCobranca.set(chave, evento);
  }

  for (const [chargeId, evento] of ultimoPorCobranca) {
    const parcelaId = primeiroUuid([evento.custom_id]);
    if (!parcelaId) continue;

    let erro: string | null = null;
    switch (evento.status?.current) {
      case "paid":
      case "settled": {
        let forma;
        try {
          forma = await adapter.metodoDoCharge(chargeId);
        } catch {
          forma = undefined; // a forma é só informativa; não impede a baixa
        }
        erro = await baixarParcelaPaga(supabase, parcelaId, { forma, idNotificacao: `efi-${chargeId}`, gateway: "efi" });
        break;
      }
      case "canceled":
        erro = await cancelarParcelaEmAberto(supabase, parcelaId, "efi");
        break;
      case "refunded":
        erro = await estornarParcelaPaga(supabase, parcelaId);
        break;
      case "unpaid":
        erro = await anotarFalhaParcela(supabase, parcelaId, "Efí", "cobrança não paga");
        break;
      default:
        break; // new, waiting, identified, approved, link, expired, contested... sem ação
    }
    if (erro) return erro;
  }
  return null;
}

export async function POST(request: Request) {
  const config = await carregarConfigGateway(GatewayTipo.Efi);
  const efiConfig = montarConfigEfi(config);
  if (!efiConfig.clientSecret) return new Response("Not configured", { status: 401 });

  const url = new URL(request.url);
  if (!tokenValido(url.searchParams.get("token"), tokenWebhookEfi(efiConfig.clientSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const adapter = new EfiAdapter(efiConfig);
  const supabase = createAdminClient();
  const corpoBruto = await request.text();
  const tipoConteudo = request.headers.get("content-type") ?? "";

  try {
    let erro: string | null = null;

    if (tipoConteudo.includes("application/json")) {
      const corpo = (() => {
        try {
          return JSON.parse(corpoBruto) as { pix?: { txid?: string }[] };
        } catch {
          return null;
        }
      })();
      for (const item of corpo?.pix ?? []) {
        if (!item.txid) continue;
        erro = await processarPix(supabase, adapter, item.txid);
        if (erro) break;
      }
    } else {
      const notificacao = new URLSearchParams(corpoBruto).get("notification");
      if (notificacao) erro = await processarNotificacao(supabase, adapter, notificacao);
    }

    if (erro) {
      console.error(`[efi-webhook] ${erro}`);
      return new Response("Erro ao processar", { status: 500 });
    }
  } catch (erro) {
    console.error("[efi-webhook] falha ao consultar a Efí", erro);
    return new Response("Erro ao consultar", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
