import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
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

// Adapter do Pagar.me (API v5, fetch direto — sem biblioteca).
//
// Cobrança = pedido (POST /orders) com um pagamento:
//  - PIX    -> pagamento "pix" direto (QR Code e "copia e cola" na resposta);
//  - boleto -> pagamento "boleto" direto (vence em `vencimento`);
//  - cartão -> pagamento "checkout": página hospedada do Pagar.me, porque cobrar
//    cartão direto exige os dados do cartão (ou um card_token gerado no navegador
//    do pagador com a Public Key), que este fluxo server-side não tem. "indefinido"
//    usa o mesmo checkout aceitando cartão, PIX e boleto.
//
// O id devolvido é o da cobrança (ch_...), usado por cancelar/consultar e pelos
// webhooks. No checkout a cobrança só nasce quando o pagador paga: até lá o id é o
// do pedido (or_...), que cancelar/consultar também aceitam.
//
// A ligação com o sistema é a `referenciaExterna` (id da parcela), gravada no
// `code` e na metadata do pedido/pagamento — o webhook usa isso pra achar a
// parcela (ver src/app/api/webhooks/pagarme/route.ts).

const PAGARME_URL = "https://api.pagar.me/core/v5";

export const PAGARME_METADATA_REFERENCIA = "referencia_externa";

export type PagarmeConfig = {
  secretKey: string;
  publicKey: string;
};

const FUSO = "-03:00"; // Brasília (sem horário de verão desde 2019)

// Fim do dia do vencimento, em Brasília, como instante ISO.
function fimDoDia(vencimento: string): Date {
  return new Date(`${vencimento}T23:59:59${FUSO}`);
}

function dataEmBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const STATUS_CHARGE: Record<string, StatusCobranca> = {
  pending: "pendente",
  processing: "pendente",
  paid: "paga",
  overpaid: "paga",
  underpaid: "outro",
  canceled: "cancelada",
  failed: "falhou",
};

export function normalizarStatusPagarme(status: string): StatusCobranca {
  return STATUS_CHARGE[status] ?? "outro";
}

export function normalizarMetodoPagarme(metodo: string | null | undefined): MetodoPagamento | undefined {
  if (metodo === "pix") return "pix";
  if (metodo === "credit_card" || metodo === "debit_card") return "cartao";
  if (metodo === "boleto") return "boleto";
  return undefined;
}

type TransacaoPagarme = {
  url?: string;
  pdf?: string;
  line?: string;
  qr_code?: string;
  qr_code_url?: string;
  due_at?: string;
};

type ChargePagarme = {
  id: string;
  code?: string;
  amount: number;
  status: string;
  payment_method?: string;
  paid_at?: string;
  last_transaction?: TransacaoPagarme;
  metadata?: Record<string, string> | null;
};

type OrderPagarme = {
  id: string;
  status: string;
  amount?: number;
  charges?: ChargePagarme[];
  checkouts?: { id: string; payment_url?: string; status?: string }[];
};

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export class PagarmeAdapter implements GatewayAdapter {
  readonly tipo = GatewayTipo.Pagarme;

  constructor(private readonly config: PagarmeConfig) {}

  private async request<T>(caminho: string, metodo: "GET" | "POST" | "PATCH" = "GET", corpo?: unknown): Promise<T> {
    if (!this.config.secretKey) {
      throw new GatewayNaoConfiguradoError("Pagar.me sem Secret Key configurada.");
    }
    const resposta = await fetch(`${PAGARME_URL}${caminho}`, {
      method: metodo,
      headers: {
        // Basic Auth: Secret Key como usuário e senha em branco.
        Authorization: `Basic ${Buffer.from(`${this.config.secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    });

    if (!resposta.ok) {
      const erro = (await resposta.json().catch(() => null)) as {
        message?: string;
        errors?: Record<string, string[] | string>;
      } | null;
      if (resposta.status === 401) throw new Error("Pagar.me recusou a chave (Secret Key inválida).");
      const detalhes = erro?.errors
        ? Object.entries(erro.errors)
            .slice(0, 3)
            .map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
            .join("; ")
        : "";
      throw new Error([erro?.message ?? `Erro na API do Pagar.me (${resposta.status}).`, detalhes].filter(Boolean).join(" — "));
    }

    return resposta.json() as Promise<T>;
  }

  // ===== Interface comum (GatewayAdapter) =====

  async testarConexao(): Promise<ResultadoTesteConexao> {
    const chave = this.config.secretKey;
    if (!chave) return { ok: false, erro: "Secret Key não informada." };
    if (!chave.startsWith("sk_")) {
      return { ok: false, erro: "A Secret Key do Pagar.me começa com sk_ (não use a Public Key pk_)." };
    }
    try {
      await this.request("/merchants/me");
      return { ok: true };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      return { ok: false, erro: /timeout|aborted/i.test(mensagem) ? "O Pagar.me não respondeu a tempo. Tente novamente." : mensagem || "Falha ao conectar no Pagar.me." };
    }
  }

  async gerarCobranca(params: CobrancaParams): Promise<CobrancaResult> {
    if (!(params.valor > 0)) throw new Error("O valor da cobrança deve ser maior que zero.");

    const documento = somenteDigitos(params.cliente.cpfCnpj);
    const telefone = somenteDigitos(params.cliente.telefone ?? "").replace(/^55(?=\d{10,11}$)/, "");
    const cliente: Record<string, unknown> = {
      name: params.cliente.nome,
      ...(params.cliente.email ? { email: params.cliente.email } : {}),
      ...(documento
        ? { document: documento, document_type: documento.length > 11 ? "CNPJ" : "CPF", type: documento.length > 11 ? "company" : "individual" }
        : { type: "individual" }),
      ...(telefone.length >= 10
        ? { phones: { mobile_phone: { country_code: "55", area_code: telefone.slice(0, 2), number: telefone.slice(2) } } }
        : {}),
    };
    if (params.cliente.endereco) {
      const e = params.cliente.endereco;
      cliente.address = {
        line_1: [e.numero, e.logradouro, e.bairro].filter(Boolean).join(", "),
        ...(e.complemento ? { line_2: e.complemento } : {}),
        zip_code: somenteDigitos(e.cep),
        city: e.cidade,
        state: e.estado,
        country: "BR",
      };
    }

    const metadata: Record<string, string> = { vencimento: params.vencimento };
    if (params.referenciaExterna) metadata[PAGARME_METADATA_REFERENCIA] = params.referenciaExterna;

    const fim = fimDoDia(params.vencimento);
    const minutosAteVencer = Math.floor((fim.getTime() - Date.now()) / 60_000);
    const pagamento = this.montarPagamento(params, fim, minutosAteVencer);

    const pedido = await this.request<OrderPagarme>("/orders", "POST", {
      code: params.referenciaExterna,
      customer: cliente,
      items: [
        {
          code: params.referenciaExterna ?? "cobranca",
          description: params.descricao.slice(0, 256) || "Cobrança",
          amount: Math.round(params.valor * 100),
          quantity: 1,
        },
      ],
      payments: [{ ...pagamento, metadata }],
      metadata,
    });

    const cobranca = pedido.charges?.[0];
    const transacao = cobranca?.last_transaction;
    const urlCheckout = pedido.checkouts?.[0]?.payment_url;

    return {
      id: cobranca?.id ?? pedido.id,
      status: normalizarStatusPagarme(cobranca?.status ?? pedido.status),
      urlPagamento: urlCheckout ?? transacao?.url,
      urlBoleto: params.metodo === "boleto" ? (transacao?.pdf ?? transacao?.url) : undefined,
      pixCopiaECola: transacao?.qr_code,
      pixQrCodeUrl: transacao?.qr_code_url,
    };
  }

  async cancelarCobranca(id: string): Promise<void> {
    if (id.startsWith("or_")) {
      // Pedido ainda sem cobrança (checkout não pago): fecha o pedido como cancelado.
      await this.request(`/orders/${id}/closed`, "PATCH", { status: "canceled" });
      return;
    }
    await this.request(`/charges/${id}/cancel`, "POST");
  }

  async consultarCobranca(id: string): Promise<CobrancaStatus> {
    if (id.startsWith("or_")) {
      const pedido = await this.request<OrderPagarme>(`/orders/${id}`);
      const cobranca = pedido.charges?.[0];
      if (cobranca) return this.paraStatus(cobranca);
      return {
        id: pedido.id,
        status: normalizarStatusPagarme(pedido.status),
        statusOriginal: pedido.status,
        valor: (pedido.amount ?? 0) / 100,
        urlPagamento: pedido.checkouts?.[0]?.payment_url,
      };
    }
    return this.paraStatus(await this.request<ChargePagarme>(`/charges/${id}`));
  }

  // ===== Específico do Pagar.me =====

  // Confere o header "X-Hub-Signature" do webhook: HMAC do corpo BRUTO com a
  // Secret Key. Aceita "sha256=<hex>", "sha1=<hex>" ou o hex puro (o algoritmo é
  // inferido pelo prefixo ou, sem prefixo, pelo tamanho). Comparação em tempo
  // constante.
  verificarAssinatura(corpoBruto: string, cabecalho: string): boolean {
    if (!this.config.secretKey) return false;
    const valor = cabecalho.trim();
    const [prefixo, hex] = valor.includes("=") ? [valor.split("=")[0].toLowerCase(), valor.split("=")[1]] : ["", valor];
    const algoritmo = prefixo === "sha1" || prefixo === "sha256" ? prefixo : hex.length === 40 ? "sha1" : "sha256";
    if (!/^[0-9a-f]+$/i.test(hex)) return false;

    const esperado = createHmac(algoritmo, this.config.secretKey).update(corpoBruto).digest();
    const recebido = Buffer.from(hex, "hex");
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  }

  private montarPagamento(params: CobrancaParams, fim: Date, minutosAteVencer: number): Record<string, unknown> {
    if (params.metodo === "pix") {
      // Vence no fim do dia do vencimento; se já passou (ou está a minutos de
      // passar), vale 24h a partir de agora.
      const pix = minutosAteVencer > 10 ? { expires_at: fim.toISOString() } : { expires_in: 24 * 60 * 60 };
      return { payment_method: "pix", pix };
    }

    if (params.metodo === "boleto") {
      return {
        payment_method: "boleto",
        boleto: {
          due_at: fim.toISOString(),
          instructions: params.descricao.slice(0, 256),
          document_number: params.referenciaExterna?.slice(0, 16),
          type: "DM",
        },
      };
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app";
    return {
      payment_method: "checkout",
      checkout: {
        // Minutos: até o vencimento (mín. 1h, máx. 30 dias).
        expires_in: Math.min(Math.max(minutosAteVencer, 60), 30 * 24 * 60),
        default_payment_method: "credit_card",
        accepted_payment_methods: params.metodo === "cartao" ? ["credit_card"] : ["credit_card", "pix", "boleto"],
        success_url: params.urlRetorno ?? `${base}/aluno/financeiro?pagamento=sucesso`,
        customer_editable: false,
        billing_address_editable: true,
      },
    };
  }

  private paraStatus(cobranca: ChargePagarme): CobrancaStatus {
    const transacao = cobranca.last_transaction;
    const vencimento = transacao?.due_at ? dataEmBrasilia(transacao.due_at) : cobranca.metadata?.vencimento;
    return {
      id: cobranca.id,
      status: normalizarStatusPagarme(cobranca.status),
      statusOriginal: cobranca.status,
      valor: cobranca.amount / 100,
      vencimento: vencimento || undefined,
      dataPagamento: cobranca.paid_at ? dataEmBrasilia(cobranca.paid_at) : undefined,
      metodo: normalizarMetodoPagarme(cobranca.payment_method),
      urlPagamento: transacao?.url,
    };
  }
}
