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
