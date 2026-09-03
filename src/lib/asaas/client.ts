import "server-only";

const ASAAS_API_URL = process.env.ASAAS_API_URL ?? "https://api.asaas.com/v3";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? "";

async function asaasRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    method,
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
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

// ===== CLIENTES =====

export async function criarClienteAsaas(dados: {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}): Promise<{ id: string }> {
  return asaasRequest<{ id: string }>("/customers", "POST", dados);
}

export async function buscarClienteAsaasPorCpf(cpf: string): Promise<{ id: string } | null> {
  const resultado = await asaasRequest<{ data: { id: string }[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpf)}`,
  );
  return resultado.data[0] ?? null;
}

// ===== COBRANÇAS =====

export async function criarCobrancaAsaas(dados: {
  customer: string;
  billingType: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
}): Promise<{ id: string; invoiceUrl: string; bankSlipUrl?: string; status: string }> {
  return asaasRequest<{ id: string; invoiceUrl: string; bankSlipUrl?: string; status: string }>(
    "/payments",
    "POST",
    dados,
  );
}

export async function cancelarCobrancaAsaas(asaasPaymentId: string): Promise<void> {
  await asaasRequest<unknown>(`/payments/${asaasPaymentId}`, "DELETE");
}

// Estorno integral — sem body, o Asaas devolve o valor ao meio de pagamento
// original automaticamente. Diferente de cancelarCobrancaAsaas (DELETE, pra
// cobrança ainda não paga): aqui a cobrança já foi recebida, então precisa
// de fato estornar o dinheiro, não só cancelar a cobrança.
export async function estornarCobrancaAsaas(asaasPaymentId: string): Promise<void> {
  await asaasRequest<unknown>(`/payments/${asaasPaymentId}/refund`, "POST");
}

// ===== PARCELAMENTO =====
// Mesmo endpoint de criarCobrancaAsaas (POST /payments), mas com
// installmentCount + totalValue — o Asaas cria todas as cobranças da vez e
// devolve a primeira, com o campo installment identificando o parcelamento
// inteiro (usado depois em buscarParcelasDoParcelamento e gerarCarneAsaas).

export async function criarParcelamentoAsaas(dados: {
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
  return asaasRequest("/payments", "POST", dados);
}

export async function buscarParcelasDoParcelamento(installmentId: string): Promise<
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
  const resultado = await asaasRequest<{
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
// binário, não JSON, então não passa por asaasRequest.
export async function gerarCarneAsaas(installmentId: string): Promise<ArrayBuffer> {
  const response = await fetch(`${ASAAS_API_URL}/installments/${installmentId}/paymentBook`, {
    headers: {
      access_token: ASAAS_API_KEY,
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error(`Não foi possível gerar o carnê no Asaas (${response.status}).`);
  }

  return response.arrayBuffer();
}

// Baixa manual (dinheiro na mão, cartão na maquininha Infinipay, etc.) —
// dá baixa no Asaas pra manter o status lá sincronizado com o pagamento
// registrado no sistema, mesmo sem ter sido o Asaas quem recebeu de fato.
export async function confirmarRecebimentoDinheiro(
  asaasPaymentId: string,
  dados: { paymentDate: string; value: number; notifyCustomer?: boolean },
): Promise<void> {
  await asaasRequest<unknown>(`/payments/${asaasPaymentId}/receiveInCash`, "POST", dados);
}

export async function buscarCobrancaAsaas(asaasPaymentId: string): Promise<{
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  paymentDate?: string;
}> {
  return asaasRequest(`/payments/${asaasPaymentId}`);
}
