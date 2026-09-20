import "server-only";

import Stripe from "stripe";
import {
  GatewayNaoConfiguradoError,
  GatewayTipo,
  type CobrancaParams,
  type CobrancaResult,
  type CobrancaStatus,
  type GatewayAdapter,
  type MetodoPagamento,
  type ResultadoTesteConexao,
  type StatusCobranca,
} from "@/lib/gateways/types";

// Adapter do Stripe (Brasil: PIX e cartão, em BRL).
//
// Cobrança = Checkout Session em modo "payment": o Stripe hospeda a página de
// pagamento (url) e o PaymentIntent é criado junto. O id devolvido é o do
// PaymentIntent (pi_...) — é o que os webhooks trazem e o que cancelar/consultar
// recebem; ids de sessão (cs_...) também são aceitos por segurança.
//
// A ligação com o sistema é a `referenciaExterna` (id da parcela), gravada em
// metadata.referencia_externa no PaymentIntent — o webhook usa isso pra achar a
// parcela (ver src/app/api/webhooks/stripe/route.ts).

export type StripeConfig = {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
};

export const STRIPE_METADATA_REFERENCIA = "referencia_externa";

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

// Checkout Session não vive mais que 24h — teto do Stripe. Cobrança com
// vencimento mais distante deve ser gerada perto da data.
const VALIDADE_SESSAO_SEGUNDOS = 24 * 60 * 60;

const STATUS_PAYMENT_INTENT: Record<Stripe.PaymentIntent.Status, StatusCobranca> = {
  requires_payment_method: "pendente",
  requires_confirmation: "pendente",
  requires_action: "pendente",
  processing: "pendente",
  requires_capture: "pendente",
  succeeded: "paga",
  canceled: "cancelada",
};

export function normalizarStatusPaymentIntent(status: string): StatusCobranca {
  return STATUS_PAYMENT_INTENT[status as Stripe.PaymentIntent.Status] ?? "outro";
}

// Tipo de método do Stripe -> método do sistema.
export function normalizarMetodoStripe(tipo: string | null | undefined): MetodoPagamento | undefined {
  if (tipo === "pix") return "pix";
  if (tipo === "card") return "cartao";
  if (tipo === "boleto") return "boleto";
  return undefined;
}

function mensagemDeErro(erro: unknown, padrao: string): string {
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}

export class StripeAdapter implements GatewayAdapter {
  readonly tipo = GatewayTipo.Stripe;
  private cliente: Stripe | null = null;

  constructor(private readonly config: StripeConfig) {}

  // Criado sob demanda: verificar a assinatura de um webhook não precisa de chave
  // de API, e sem chave nenhuma o erro tem que ser claro (não um crash do SDK).
  private stripe(): Stripe {
    if (!this.config.secretKey) {
      throw new GatewayNaoConfiguradoError("Stripe sem Secret Key configurada.");
    }
    this.cliente ??= new Stripe(this.config.secretKey, { timeout: 20_000 });
    return this.cliente;
  }

  // ===== Interface comum (GatewayAdapter) =====

  async testarConexao(): Promise<ResultadoTesteConexao> {
    const chave = this.config.secretKey;
    if (!chave) return { ok: false, erro: "Secret Key não informada." };
    if (!/^(sk|rk)_(test|live)_/.test(chave)) {
      return { ok: false, erro: "A Secret Key deve começar com sk_test_ ou sk_live_ (ou rk_ para chave restrita)." };
    }
    try {
      // Devolve a própria conta da chave — só lê, não cria nada.
      await this.stripe().accounts.retrieveCurrent();
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: mensagemDeErro(erro, "Falha ao conectar no Stripe.") };
    }
  }

  async gerarCobranca(params: CobrancaParams): Promise<CobrancaResult> {
    if (params.metodo === "boleto") {
      throw new Error("O Stripe está integrado apenas para PIX e cartão. Escolha PIX ou cartão.");
    }
    if (!(params.valor > 0)) throw new Error("O valor da cobrança deve ser maior que zero.");

    const metodos: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      params.metodo === "pix" ? ["pix"] : params.metodo === "cartao" ? ["card"] : ["card", "pix"];

    const base = process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO;
    const urlRetorno = params.urlRetorno ?? `${base}/aluno/financeiro`;
    const separador = urlRetorno.includes("?") ? "&" : "?";

    const metadata: Record<string, string> = {
      cliente_nome: params.cliente.nome.slice(0, 200),
      cliente_cpf_cnpj: params.cliente.cpfCnpj,
      vencimento: params.vencimento,
    };
    if (params.referenciaExterna) metadata[STRIPE_METADATA_REFERENCIA] = params.referenciaExterna;

    try {
      const sessao = await this.stripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: metodos,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "brl",
              unit_amount: Math.round(params.valor * 100),
              product_data: { name: params.descricao.slice(0, 250) || "Cobrança" },
            },
          },
        ],
        customer_email: params.cliente.email || undefined,
        client_reference_id: params.referenciaExterna,
        success_url: `${urlRetorno}${separador}pagamento=sucesso`,
        cancel_url: `${urlRetorno}${separador}pagamento=cancelado`,
        expires_at: Math.floor(Date.now() / 1000) + VALIDADE_SESSAO_SEGUNDOS,
        metadata,
        // O PaymentIntent é o objeto dos webhooks: leva a mesma metadata.
        payment_intent_data: { metadata, description: params.descricao.slice(0, 500) },
      });

      const paymentIntentId = typeof sessao.payment_intent === "string" ? sessao.payment_intent : sessao.payment_intent?.id;
      return {
        id: paymentIntentId ?? sessao.id,
        status: "pendente",
        urlPagamento: sessao.url ?? undefined,
      };
    } catch (erro) {
      throw new Error(mensagemDeErro(erro, "Não foi possível criar a cobrança no Stripe."));
    }
  }

  async cancelarCobranca(id: string): Promise<void> {
    try {
      if (id.startsWith("cs_")) {
        // Sessão de checkout: expirar cancela o pagamento pendente dela.
        await this.stripe().checkout.sessions.expire(id);
        return;
      }
      await this.stripe().paymentIntents.cancel(id);
    } catch (erro) {
      throw new Error(mensagemDeErro(erro, "Não foi possível cancelar a cobrança no Stripe."));
    }
  }

  async consultarCobranca(id: string): Promise<CobrancaStatus> {
    try {
      if (id.startsWith("cs_")) {
        const sessao = await this.stripe().checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
        const intent = typeof sessao.payment_intent === "object" ? sessao.payment_intent : null;
        if (intent) return this.paraStatus(intent);
        return {
          id: sessao.id,
          status: sessao.status === "expired" ? "cancelada" : sessao.payment_status === "paid" ? "paga" : "pendente",
          statusOriginal: `${sessao.status ?? "?"}/${sessao.payment_status}`,
          valor: (sessao.amount_total ?? 0) / 100,
          urlPagamento: sessao.url ?? undefined,
        };
      }
      const intent = await this.stripe().paymentIntents.retrieve(id, { expand: ["latest_charge"] });
      return this.paraStatus(intent);
    } catch (erro) {
      throw new Error(mensagemDeErro(erro, "Não foi possível consultar a cobrança no Stripe."));
    }
  }

  // ===== Específico do Stripe =====

  // Confere a assinatura do webhook (header "stripe-signature") sobre o corpo
  // BRUTO da requisição. Lança se for inválida — quem chama responde 400.
  verificarWebhook(corpoBruto: string, assinatura: string): Stripe.Event {
    if (!this.config.webhookSecret) {
      throw new GatewayNaoConfiguradoError("Stripe sem Webhook Secret configurado.");
    }
    // Instância sem chave de API serve pra verificação (não faz requisição).
    const stripe = this.cliente ?? new Stripe(this.config.secretKey || "sk_webhook_only");
    return stripe.webhooks.constructEvent(corpoBruto, assinatura, this.config.webhookSecret);
  }

  // Método usado no pagamento (PIX/cartão), lido do PaymentIntent já pago.
  async metodoDoPaymentIntent(intent: Stripe.PaymentIntent): Promise<MetodoPagamento | undefined> {
    if (intent.payment_method_types.length === 1) return normalizarMetodoStripe(intent.payment_method_types[0]);
    try {
      const completo = await this.stripe().paymentIntents.retrieve(intent.id, { expand: ["latest_charge"] });
      const charge = typeof completo.latest_charge === "object" ? completo.latest_charge : null;
      return normalizarMetodoStripe(charge?.payment_method_details?.type);
    } catch {
      return undefined;
    }
  }

  private paraStatus(intent: Stripe.PaymentIntent): CobrancaStatus {
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    const vencimento = intent.metadata?.vencimento;
    return {
      id: intent.id,
      status: normalizarStatusPaymentIntent(intent.status),
      statusOriginal: intent.status,
      valor: intent.amount / 100,
      vencimento: vencimento || undefined,
      dataPagamento:
        intent.status === "succeeded" && charge ? new Date(charge.created * 1000).toISOString().slice(0, 10) : undefined,
      metodo: normalizarMetodoStripe(charge?.payment_method_details?.type ?? intent.payment_method_types[0]),
    };
  }
}
