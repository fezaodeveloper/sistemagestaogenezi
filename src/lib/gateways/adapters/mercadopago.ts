import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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

// Adapter do Mercado Pago (fetch direto, Bearer {accessToken}).
//
// Cobrança:
//  - PIX    -> POST /v1/payments (pagamento direto: QR Code e "copia e cola" na resposta);
//  - cartão / boleto / indefinido -> POST /checkout/preferences (página de pagamento
//    hospedada; "indefinido" aceita todos os meios). O pagamento só nasce quando o
//    pagador paga: até lá o id é o da preferência (tem hífen), enquanto o id de
//    pagamento é numérico — cancelar/consultar entendem os dois.
//
// A ligação com o sistema é a `referenciaExterna` (id da parcela), gravada em
// external_reference — o webhook usa isso pra achar a parcela (ver
// src/app/api/webhooks/mercadopago/route.ts).

const MP_URL = "https://api.mercadopago.com";
const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

export type MercadoPagoConfig = {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
};

const FUSO = "-03:00"; // Brasília (sem horário de verão desde 2019)

function dataEmBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const STATUS_PAGAMENTO: Record<string, StatusCobranca> = {
  pending: "pendente",
  in_process: "pendente",
  in_mediation: "pendente",
  authorized: "pendente",
  approved: "paga",
  rejected: "falhou",
  cancelled: "cancelada",
  refunded: "estornada",
  charged_back: "estornada",
};

export function normalizarStatusMercadoPago(status: string): StatusCobranca {
  return STATUS_PAGAMENTO[status] ?? "outro";
}

export function normalizarMetodoMercadoPago(pagamento: {
  payment_type_id?: string;
  payment_method_id?: string;
}): MetodoPagamento | undefined {
  if (pagamento.payment_method_id === "pix") return "pix";
  if (pagamento.payment_type_id === "credit_card" || pagamento.payment_type_id === "debit_card") return "cartao";
  if (pagamento.payment_type_id === "ticket") return "boleto";
  return undefined;
}

export type PagamentoMercadoPago = {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  external_reference?: string | null;
  payment_type_id?: string;
  payment_method_id?: string;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  metadata?: Record<string, unknown> | null;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
  transaction_details?: { external_resource_url?: string | null };
};

type PreferenciaMercadoPago = {
  id: string;
  init_point?: string;
  external_reference?: string;
  expiration_date_to?: string;
  expires?: boolean;
  items?: { unit_price: number; quantity: number }[];
};

// Preferência (id com hífen) vs. pagamento (só dígitos).
function ehPagamento(id: string): boolean {
  return /^\d+$/.test(id);
}

export class MercadoPagoAdapter implements GatewayAdapter {
  readonly tipo = GatewayTipo.Mercadopago;

  constructor(private readonly config: MercadoPagoConfig) {}

  private async request<T>(
    caminho: string,
    metodo: "GET" | "POST" | "PUT" = "GET",
    corpo?: unknown,
    cabecalhos: Record<string, string> = {},
  ): Promise<T> {
    if (!this.config.accessToken) {
      throw new GatewayNaoConfiguradoError("Mercado Pago sem Access Token configurado.");
    }
    const resposta = await fetch(`${MP_URL}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...cabecalhos,
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20_000),
    });

    if (!resposta.ok) {
      const erro = (await resposta.json().catch(() => null)) as {
        message?: string;
        error?: string;
        cause?: { description?: string }[];
      } | null;
      if (resposta.status === 401) throw new Error("Mercado Pago recusou o Access Token (inválido ou expirado).");
      const causa = erro?.cause?.[0]?.description;
      throw new Error(
        [erro?.message ?? erro?.error ?? `Erro na API do Mercado Pago (${resposta.status}).`, causa].filter(Boolean).join(" — "),
      );
    }

    return resposta.json() as Promise<T>;
  }

  // ===== Interface comum (GatewayAdapter) =====

  async testarConexao(): Promise<ResultadoTesteConexao> {
    if (!this.config.accessToken) return { ok: false, erro: "Access Token não informado." };
    try {
      // Só lista os meios de pagamento da conta — falha com 401 se o token for inválido.
      await this.request("/v1/payment_methods");
      return { ok: true };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      return {
        ok: false,
        erro: /timeout|aborted/i.test(mensagem) ? "O Mercado Pago não respondeu a tempo. Tente novamente." : mensagem || "Falha ao conectar no Mercado Pago.",
      };
    }
  }

  async gerarCobranca(params: CobrancaParams): Promise<CobrancaResult> {
    if (!(params.valor > 0)) throw new Error("O valor da cobrança deve ser maior que zero.");

    const base = process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO;
    const notificationUrl = `${base}/api/webhooks/mercadopago`;
    const fim = `${params.vencimento}T23:59:59.000${FUSO}`;
    const minutosAteVencer = Math.floor((new Date(fim).getTime() - Date.now()) / 60_000);
    const metadata: Record<string, string> = { vencimento: params.vencimento };
    if (params.referenciaExterna) metadata.referencia_externa = params.referenciaExterna;

    const [nome, ...resto] = params.cliente.nome.trim().split(/\s+/);
    const sobrenome = resto.join(" ") || undefined;
    const documento = params.cliente.cpfCnpj.replace(/\D/g, "");
    const identificacao = documento ? { type: documento.length > 11 ? "CNPJ" : "CPF", number: documento } : undefined;

    if (params.metodo === "pix") {
      if (!params.cliente.email) {
        throw new Error("O Mercado Pago exige o e-mail do pagador para gerar PIX.");
      }
      const pagamento = await this.request<PagamentoMercadoPago>(
        "/v1/payments",
        "POST",
        {
          transaction_amount: Number(params.valor.toFixed(2)),
          description: params.descricao.slice(0, 250) || "Cobrança",
          payment_method_id: "pix",
          payer: { email: params.cliente.email, first_name: nome, last_name: sobrenome, identification: identificacao },
          external_reference: params.referenciaExterna,
          notification_url: notificationUrl,
          metadata,
          // Mín. 30 min e máx. 30 dias; fora disso vale o padrão do Mercado Pago (24h).
          ...(minutosAteVencer >= 30 && minutosAteVencer <= 30 * 24 * 60 ? { date_of_expiration: fim } : {}),
        },
        // A mesma parcela/valor/vencimento reenviada devolve o MESMO pagamento (sem duplicar).
        { "X-Idempotency-Key": `${params.referenciaExterna ?? randomUUID()}-${Math.round(params.valor * 100)}-${params.vencimento}` },
      );
      const dados = pagamento.point_of_interaction?.transaction_data;
      return {
        id: String(pagamento.id),
        status: normalizarStatusMercadoPago(pagamento.status),
        urlPagamento: dados?.ticket_url,
        pixCopiaECola: dados?.qr_code,
        pixQrCodeUrl: dados?.qr_code_base64 ? `data:image/png;base64,${dados.qr_code_base64}` : undefined,
      };
    }

    // Cartão, boleto ou indefinido: página hospedada (preferência de checkout).
    const excluidos =
      params.metodo === "cartao"
        ? ["ticket", "bank_transfer", "atm"]
        : params.metodo === "boleto"
          ? ["credit_card", "debit_card", "prepaid_card", "bank_transfer", "atm", "digital_wallet", "digital_currency"]
          : [];
    const retorno = params.urlRetorno ?? `${base}/aluno/financeiro`;
    const separador = retorno.includes("?") ? "&" : "?";

    const preferencia = await this.request<PreferenciaMercadoPago>("/checkout/preferences", "POST", {
      items: [
        {
          id: params.referenciaExterna ?? "cobranca",
          title: params.descricao.slice(0, 250) || "Cobrança",
          quantity: 1,
          unit_price: Number(params.valor.toFixed(2)),
          currency_id: "BRL",
        },
      ],
      payer: {
        name: nome,
        surname: sobrenome,
        ...(params.cliente.email ? { email: params.cliente.email } : {}),
        ...(identificacao ? { identification: identificacao } : {}),
      },
      payment_methods: { excluded_payment_types: excluidos.map((id) => ({ id })) },
      external_reference: params.referenciaExterna,
      notification_url: notificationUrl,
      back_urls: {
        success: `${retorno}${separador}pagamento=sucesso`,
        pending: `${retorno}${separador}pagamento=pendente`,
        failure: `${retorno}${separador}pagamento=cancelado`,
      },
      auto_return: "approved",
      metadata,
      ...(minutosAteVencer > 30
        ? { expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: fim }
        : {}),
    });

    return { id: preferencia.id, status: "pendente", urlPagamento: preferencia.init_point };
  }

  async cancelarCobranca(id: string): Promise<void> {
    if (ehPagamento(id)) {
      // Só pagamentos ainda pendentes/em processamento podem ser cancelados.
      await this.request(`/v1/payments/${id}`, "PUT", { status: "cancelled" });
      return;
    }
    // Preferência: não há "cancelar" — expira o link agora.
    const agora = Date.now();
    await this.request(`/checkout/preferences/${id}`, "PUT", {
      expires: true,
      expiration_date_from: new Date(agora - 120_000).toISOString(),
      expiration_date_to: new Date(agora - 60_000).toISOString(),
    });
  }

  async consultarCobranca(id: string): Promise<CobrancaStatus> {
    if (ehPagamento(id)) return this.paraStatus(await this.consultarPagamento(id));

    const preferencia = await this.request<PreferenciaMercadoPago>(`/checkout/preferences/${id}`);
    // O pagamento mais recente ligado à referência da preferência, se já houver.
    if (preferencia.external_reference) {
      const busca = await this.request<{ results?: PagamentoMercadoPago[] }>(
        `/v1/payments/search?external_reference=${encodeURIComponent(preferencia.external_reference)}&sort=date_created&criteria=desc&limit=1`,
      );
      const ultimo = busca.results?.[0];
      if (ultimo) return this.paraStatus(ultimo);
    }
    const expirada = !!preferencia.expiration_date_to && new Date(preferencia.expiration_date_to).getTime() < Date.now();
    return {
      id: preferencia.id,
      status: expirada ? "cancelada" : "pendente",
      statusOriginal: expirada ? "expired" : "pending",
      valor: (preferencia.items ?? []).reduce((soma, item) => soma + item.unit_price * item.quantity, 0),
    };
  }

  // ===== Específico do Mercado Pago =====

  async consultarPagamento(id: string): Promise<PagamentoMercadoPago> {
    return this.request<PagamentoMercadoPago>(`/v1/payments/${id}`);
  }

  // Confere x-signature ("ts=<epoch>,v1=<hmac>") do webhook. O HMAC-SHA256 (chave =
  // webhookSecret) é calculado sobre o "manifest":
  //   id:<data.id da URL>;request-id:<x-request-id>;ts:<ts>;
  // — partes ausentes são omitidas. Comparação em tempo constante.
  verificarAssinatura(entrada: { xSignature: string; xRequestId: string | null; dataId: string | null }): boolean {
    if (!this.config.webhookSecret) return false;
    const partes = Object.fromEntries(
      entrada.xSignature.split(",").map((parte) => {
        const [chave, ...valor] = parte.trim().split("=");
        return [chave, valor.join("=")];
      }),
    ) as Record<string, string | undefined>;
    const ts = partes.ts;
    const v1 = partes.v1;
    if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;

    // O id, quando alfanumérico, entra em minúsculas no manifest.
    const id = entrada.dataId ? (/^[a-z0-9]+$/i.test(entrada.dataId) ? entrada.dataId.toLowerCase() : entrada.dataId) : null;
    const manifest = `${id ? `id:${id};` : ""}${entrada.xRequestId ? `request-id:${entrada.xRequestId};` : ""}ts:${ts};`;

    const esperado = createHmac("sha256", this.config.webhookSecret).update(manifest).digest();
    const recebido = Buffer.from(v1, "hex");
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  }

  private paraStatus(pagamento: PagamentoMercadoPago): CobrancaStatus {
    const vencimento = pagamento.date_of_expiration
      ? dataEmBrasilia(pagamento.date_of_expiration)
      : typeof pagamento.metadata?.vencimento === "string"
        ? pagamento.metadata.vencimento
        : undefined;
    return {
      id: String(pagamento.id),
      status: normalizarStatusMercadoPago(pagamento.status),
      statusOriginal: pagamento.status,
      valor: pagamento.transaction_amount,
      vencimento,
      dataPagamento: pagamento.date_approved ? dataEmBrasilia(pagamento.date_approved) : undefined,
      metodo: normalizarMetodoMercadoPago(pagamento),
      urlPagamento: pagamento.point_of_interaction?.transaction_data?.ticket_url ?? pagamento.transaction_details?.external_resource_url ?? undefined,
    };
  }
}
