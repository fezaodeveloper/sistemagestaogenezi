import "server-only";

import { carregarConfigGateway } from "@/lib/gateways/config";
import {
  GatewayTipo,
  type CobrancaParams,
  type CobrancaResult,
  type CobrancaStatus,
  type GatewayAdapter,
  type MetodoCobranca,
  type MetodoPagamento,
  type ResultadoTesteConexao,
  type StatusCobranca,
} from "@/lib/gateways/types";

// Adapter do Asaas. A lógica de chamada à API que vivia em src/lib/asaas/client.ts
// mora aqui; client.ts virou uma camada fina de compatibilidade (mesmas funções
// exportadas, mesmas assinaturas) que delega pra este adapter — nenhum ponto de
// chamada existente (webhooks, crons, Server Actions) precisou mudar.

const ASAAS_URL_PRODUCAO = "https://api.asaas.com/v3";
const ASAAS_URL_SANDBOX = "https://sandbox.asaas.com/api/v3";

export type AsaasConfig = { apiKey: string; apiUrl: string };

// Junta as duas fontes de credencial, com a MESMA precedência do sistema antigo
// como rede de segurança:
//  1. chave salva em gateways_config (tela /admin/configuracoes/gateways);
//  2. variáveis de ambiente ASAAS_API_KEY / ASAAS_API_URL (como sempre foi).
// Sem linha no banco, sem chave salva ou com a tabela ainda inexistente, tudo
// cai no item 2 — comportamento idêntico ao de antes desta mudança.
export function montarConfigAsaas(apiKeySalva: string | undefined, sandbox: boolean): AsaasConfig {
  const urlAmbiente = process.env.ASAAS_API_URL || ASAAS_URL_PRODUCAO;
  const chave = apiKeySalva?.trim();
  if (chave) {
    return { apiKey: chave, apiUrl: sandbox ? ASAAS_URL_SANDBOX : urlAmbiente };
  }
  return { apiKey: process.env.ASAAS_API_KEY ?? "", apiUrl: urlAmbiente };
}

export function asaasTemChaveNoAmbiente(): boolean {
  return !!process.env.ASAAS_API_KEY?.trim();
}

export async function resolverConfigAsaas(): Promise<AsaasConfig> {
  const config = await carregarConfigGateway(GatewayTipo.Asaas);
  return montarConfigAsaas(config?.credenciais.apiKey, config?.sandbox ?? false);
}

export async function obterAsaasAdapter(): Promise<AsaasAdapter> {
  return new AsaasAdapter(await resolverConfigAsaas());
}

const STATUS_ASAAS: Record<string, StatusCobranca> = {
  PENDING: "pendente",
  AWAITING_RISK_ANALYSIS: "pendente",
  RECEIVED: "paga",
  CONFIRMED: "paga",
  RECEIVED_IN_CASH: "paga",
  OVERDUE: "vencida",
  DELETED: "cancelada",
  REFUNDED: "estornada",
  REFUND_REQUESTED: "estornada",
  REFUND_IN_PROGRESS: "estornada",
};

function normalizarStatus(status: string): StatusCobranca {
  return STATUS_ASAAS[status] ?? "outro";
}

const BILLING_TYPE: Record<MetodoCobranca, "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED"> = {
  pix: "PIX",
  cartao: "CREDIT_CARD",
  boleto: "BOLETO",
  indefinido: "UNDEFINED",
};

function normalizarMetodo(billingType: string | undefined): MetodoPagamento | undefined {
  if (billingType === "PIX") return "pix";
  if (billingType === "CREDIT_CARD" || billingType === "DEBIT_CARD") return "cartao";
  if (billingType === "BOLETO") return "boleto";
  return undefined;
}

export class AsaasAdapter implements GatewayAdapter {
  readonly tipo = GatewayTipo.Asaas;

  constructor(private readonly config: AsaasConfig) {}

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
      method,
      headers: {
        access_token: this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        (errorBody as { errors?: { description?: string }[] } | null)?.errors?.[0]?.description ??
        `Erro na API do Asaas (${response.status}).`;
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  // ===== Interface comum (GatewayAdapter) =====

  async testarConexao(): Promise<ResultadoTesteConexao> {
    if (!this.config.apiKey) {
      return { ok: false, erro: "API Key não informada (nem salva aqui, nem em ASAAS_API_KEY)." };
    }
    try {
      // Listagem mínima: falha com 401 se a chave for inválida, sem criar nada.
      await this.request("/customers?limit=1", "GET", undefined, AbortSignal.timeout(15_000));
      return { ok: true };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "";
      return {
        ok: false,
        erro: /timeout|aborted/i.test(mensagem) ? "O Asaas não respondeu a tempo. Tente novamente." : mensagem || "Falha ao conectar no Asaas.",
      };
    }
  }

  async gerarCobranca(params: CobrancaParams): Promise<CobrancaResult> {
    const existente = await this.buscarClientePorCpf(params.cliente.cpfCnpj);
    const cliente =
      existente ??
      (await this.criarCliente({
        name: params.cliente.nome,
        cpfCnpj: params.cliente.cpfCnpj,
        email: params.cliente.email,
        phone: params.cliente.telefone,
      }));

    const cobranca = await this.criarCobranca({
      customer: cliente.id,
      billingType: BILLING_TYPE[params.metodo],
      value: params.valor,
      dueDate: params.vencimento,
      description: params.descricao,
      externalReference: params.referenciaExterna,
    });

    return {
      id: cobranca.id,
      status: normalizarStatus(cobranca.status),
      urlPagamento: cobranca.invoiceUrl,
      urlBoleto: cobranca.bankSlipUrl,
    };
  }

  async cancelarCobranca(id: string): Promise<void> {
    await this.request<unknown>(`/payments/${id}`, "DELETE");
  }

  async consultarCobranca(id: string): Promise<CobrancaStatus> {
    const cobranca = await this.buscarCobranca(id);
    return {
      id: cobranca.id,
      status: normalizarStatus(cobranca.status),
      statusOriginal: cobranca.status,
      valor: cobranca.value,
      vencimento: cobranca.dueDate,
      dataPagamento: cobranca.paymentDate,
      metodo: normalizarMetodo(cobranca.billingType),
      urlPagamento: cobranca.invoiceUrl,
    };
  }

  // ===== Operações específicas do Asaas (lógica migrada de src/lib/asaas/client.ts) =====

  // ----- Clientes -----

  async criarCliente(dados: {
    name: string;
    cpfCnpj: string;
    email?: string;
    phone?: string;
  }): Promise<{ id: string }> {
    return this.request<{ id: string }>("/customers", "POST", dados);
  }

  async buscarClientePorCpf(cpf: string): Promise<{ id: string } | null> {
    const resultado = await this.request<{ data: { id: string }[] }>(
      `/customers?cpfCnpj=${encodeURIComponent(cpf)}`,
    );
    return resultado.data[0] ?? null;
  }

  // ----- Cobranças -----

  async criarCobranca(dados: {
    customer: string;
    billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
    value: number;
    dueDate: string;
    description: string;
    externalReference?: string;
  }): Promise<{ id: string; invoiceUrl: string; bankSlipUrl?: string; status: string }> {
    return this.request<{ id: string; invoiceUrl: string; bankSlipUrl?: string; status: string }>(
      "/payments",
      "POST",
      dados,
    );
  }

  // Estorno integral — sem body, o Asaas devolve o valor ao meio de pagamento
  // original automaticamente. Diferente de cancelarCobranca (DELETE, pra
  // cobrança ainda não paga): aqui a cobrança já foi recebida, então precisa
  // de fato estornar o dinheiro, não só cancelar a cobrança.
  async estornarCobranca(asaasPaymentId: string): Promise<void> {
    await this.request<unknown>(`/payments/${asaasPaymentId}/refund`, "POST");
  }

  // ----- Parcelamento -----
  // Mesmo endpoint de criarCobranca (POST /payments), mas com installmentCount +
  // totalValue — o Asaas cria todas as cobranças da vez e devolve a primeira,
  // com o campo installment identificando o parcelamento inteiro (usado depois
  // em buscarParcelasDoParcelamento e gerarCarne).

  async criarParcelamento(dados: {
    customer: string;
    billingType: "BOLETO";
    totalValue: number;
    installmentCount: number;
    dueDate: string;
    description: string;
    externalReference?: string;
  }): Promise<{
    id: string;
    installment: string;
    invoiceUrl: string;
    bankSlipUrl?: string;
    status: string;
  }> {
    return this.request("/payments", "POST", dados);
  }

  async buscarParcelasDoParcelamento(installmentId: string): Promise<
    Array<{
      id: string;
      installmentNumber: number;
      value: number;
      dueDate: string;
      status: string;
      invoiceUrl: string;
      bankSlipUrl?: string;
    }>
  > {
    const resultado = await this.request<{
      data: Array<{
        id: string;
        installmentNumber: number;
        value: number;
        dueDate: string;
        status: string;
        invoiceUrl: string;
        bankSlipUrl?: string;
      }>;
    }>(`/installments/${installmentId}/payments`);
    return resultado.data;
  }

  // Carnê oficial do Asaas (boleto + QR Code Pix de todas as parcelas) — PDF
  // binário, não JSON, então a chamada final não passa por request(). O 400
  // genérico que o Asaas devolve em /paymentBook não diz o motivo real
  // (parcelamento inexistente vs. parcelamento só com Pix, sem boleto) — os dois
  // GETs abaixo diagnosticam a causa antes, pra devolver uma mensagem que o
  // admin consegue agir (ver ITEM 13).
  async gerarCarne(installmentId: string): Promise<ArrayBuffer> {
    try {
      await this.request<unknown>(`/installments/${installmentId}`);
    } catch {
      throw new Error("Parcelamento não encontrado no Asaas.");
    }

    const cobrancas = await this.request<{ data: { billingType: string }[] }>(
      `/payments?installment=${installmentId}`,
    );
    const temBoleto = cobrancas.data.some((cobranca) => cobranca.billingType === "BOLETO");
    if (!temBoleto) {
      throw new Error(
        "Este parcelamento não tem boletos gerados. O carnê só está disponível para cobranças com boleto.",
      );
    }

    const response = await fetch(`${this.config.apiUrl}/installments/${installmentId}/paymentBook`, {
      headers: {
        access_token: this.config.apiKey,
        Accept: "application/pdf",
      },
    });

    if (!response.ok) {
      throw new Error(`Não foi possível gerar o carnê no Asaas (${response.status}).`);
    }

    return response.arrayBuffer();
  }

  // Baixa manual (dinheiro na mão, cartão na maquininha Infinipay, etc.) — dá
  // baixa no Asaas pra manter o status lá sincronizado com o pagamento
  // registrado no sistema, mesmo sem ter sido o Asaas quem recebeu de fato.
  async confirmarRecebimentoDinheiro(
    asaasPaymentId: string,
    dados: { paymentDate: string; value: number; notifyCustomer?: boolean },
  ): Promise<void> {
    await this.request<unknown>(`/payments/${asaasPaymentId}/receiveInCash`, "POST", dados);
  }

  async buscarCobranca(asaasPaymentId: string): Promise<{
    id: string;
    status: string;
    value: number;
    dueDate: string;
    billingType?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    paymentDate?: string;
  }> {
    return this.request(`/payments/${asaasPaymentId}`);
  }

  // ----- Assinaturas (Gênezi Conecta — candidatos externos pagos) -----
  // Cobrança recorrente mensal, diferente do resto do financeiro (cobrança
  // avulsa por parcela) — endpoints /customers e /subscriptions próprios do
  // Asaas para esse modelo.

  async criarClienteConecta(dados: {
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
  }): Promise<{ id: string }> {
    return this.request<{ id: string }>("/customers", "POST", dados);
  }

  // invoiceUrl é opcional aqui de propósito: o objeto de assinatura do Asaas
  // não traz o link de pagamento (isso pertence à primeira COBRANÇA gerada a
  // partir dela, buscada separadamente em buscarCobrancasAssinaturaConecta,
  // logo depois da criação) — o campo fica tipado como opcional só pra não
  // quebrar se uma versão futura da API passar a incluir.
  async criarAssinaturaConecta(dados: {
    customer: string;
    billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
    value: number;
    nextDueDate: string;
    cycle: "MONTHLY";
    description: string;
  }): Promise<{ id: string; status: string; invoiceUrl?: string }> {
    return this.request<{ id: string; status: string; invoiceUrl?: string }>("/subscriptions", "POST", dados);
  }

  async cancelarAssinaturaConecta(subscriptionId: string): Promise<void> {
    await this.request<unknown>(`/subscriptions/${subscriptionId}`, "DELETE");
  }

  async buscarStatusAssinaturaConecta(subscriptionId: string): Promise<{ id: string; status: string }> {
    return this.request<{ id: string; status: string }>(`/subscriptions/${subscriptionId}`);
  }

  // Cobranças geradas por uma assinatura — a mais recente (primeira da lista, já
  // vem ordenada por dueDate ascendente com a próxima em aberto primeiro) é a que
  // o candidato precisa pagar agora. billingType vem junto pra decidir, na página
  // de espera, se mostra o fluxo de PIX (QR Code) ou só o link/boleto.
  async buscarCobrancasAssinaturaConecta(subscriptionId: string): Promise<
    Array<{
      id: string;
      status: string;
      billingType: string;
      invoiceUrl: string;
      bankSlipUrl?: string;
    }>
  > {
    const resultado = await this.request<{
      data: Array<{
        id: string;
        status: string;
        billingType: string;
        invoiceUrl: string;
        bankSlipUrl?: string;
      }>;
    }>(`/subscriptions/${subscriptionId}/payments`);
    return resultado.data;
  }

  // QR Code Pix de uma cobrança específica — o Asaas não inclui isso na lista de
  // cobranças acima (nem no payload da cobrança em si), é um endpoint à parte.
  // encodedImage já vem em base64 (pronto pra <img src="data:...">), payload é o
  // "copia e cola".
  async buscarQrCodePixConecta(paymentId: string): Promise<{ encodedImage: string; payload: string }> {
    return this.request<{ encodedImage: string; payload: string }>(`/payments/${paymentId}/pixQrCode`);
  }
}
