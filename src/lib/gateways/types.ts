// Contrato comum dos gateways de pagamento. Cada gateway (Asaas, Stripe,
// Pagar.me, Mercado Pago, Efí) tem um adapter em ./adapters que implementa
// GatewayAdapter; o resto do sistema fala só com essa interface (via manager.ts).

export enum GatewayTipo {
  Asaas = "asaas",
  Stripe = "stripe",
  Pagarme = "pagarme",
  Mercadopago = "mercadopago",
  Efi = "efi",
}

export const GATEWAY_TIPOS: readonly GatewayTipo[] = [
  GatewayTipo.Asaas,
  GatewayTipo.Stripe,
  GatewayTipo.Pagarme,
  GatewayTipo.Mercadopago,
  GatewayTipo.Efi,
];

export function isGatewayTipo(valor: unknown): valor is GatewayTipo {
  return typeof valor === "string" && (GATEWAY_TIPOS as readonly string[]).includes(valor);
}

export type MetodoPagamento = "pix" | "cartao" | "boleto";

export const METODO_PAGAMENTO_LABELS: Record<MetodoPagamento, string> = {
  pix: "PIX",
  cartao: "Cartão",
  boleto: "Boleto",
};

// "indefinido": deixa o pagador escolher o método na página de pagamento do gateway.
export type MetodoCobranca = MetodoPagamento | "indefinido";

export type CobrancaParams = {
  cliente: {
    nome: string;
    cpfCnpj: string;
    email?: string;
    telefone?: string;
    // Opcional. Alguns meios (ex.: boleto no Pagar.me) podem exigir o endereço.
    endereco?: {
      logradouro: string;
      numero: string;
      bairro: string;
      cep: string;
      cidade: string;
      estado: string;
      complemento?: string;
    };
  };
  // Em reais (não centavos).
  valor: number;
  // YYYY-MM-DD
  vencimento: string;
  descricao: string;
  metodo: MetodoCobranca;
  // Identificador do lado do sistema (ex.: id da parcela) devolvido nos webhooks.
  referenciaExterna?: string;
  // Pra onde o pagador volta depois de pagar/cancelar, nos gateways com página de
  // pagamento hospedada (ex.: Stripe Checkout). Vazio = página padrão do sistema.
  urlRetorno?: string;
};

// Status normalizado — cada adapter traduz o status do seu gateway pra estes.
export type StatusCobranca = "pendente" | "paga" | "vencida" | "cancelada" | "estornada" | "falhou" | "outro";

export type CobrancaResult = {
  id: string;
  status: StatusCobranca;
  // Página de pagamento hospedada pelo gateway.
  urlPagamento?: string;
  urlBoleto?: string;
  // PIX (quando a cobrança é PIX direto): "copia e cola" e imagem do QR Code.
  pixCopiaECola?: string;
  pixQrCodeUrl?: string;
};

export type CobrancaStatus = {
  id: string;
  status: StatusCobranca;
  // Status como o gateway informa, sem tradução (útil pra diagnóstico).
  statusOriginal: string;
  valor: number;
  vencimento?: string;
  dataPagamento?: string;
  metodo?: MetodoPagamento;
  urlPagamento?: string;
};

export type ResultadoTesteConexao = { ok: boolean; erro?: string };

export interface GatewayAdapter {
  readonly tipo: GatewayTipo;
  testarConexao(): Promise<ResultadoTesteConexao>;
  gerarCobranca(params: CobrancaParams): Promise<CobrancaResult>;
  cancelarCobranca(id: string): Promise<void>;
  consultarCobranca(id: string): Promise<CobrancaStatus>;
}

export const MENSAGEM_GATEWAY_NAO_CONFIGURADO = "Gateway não configurado";

export class GatewayNaoConfiguradoError extends Error {
  constructor(message: string = MENSAGEM_GATEWAY_NAO_CONFIGURADO) {
    super(message);
    this.name = "GatewayNaoConfiguradoError";
  }
}

// Taxas cobradas pelo gateway (todas opcionais) — só informativas por enquanto.
export type TaxasGateway = {
  pix_percentual?: number;
  cartao_percentual?: number;
  cartao_fixo?: number;
  boleto_percentual?: number;
  boleto_fixo?: number;
};

export const TAXA_CAMPOS = [
  { chave: "pix_percentual", label: "PIX (%)", tipo: "percentual" },
  { chave: "cartao_percentual", label: "Cartão (%)", tipo: "percentual" },
  { chave: "cartao_fixo", label: "Cartão — valor fixo (R$)", tipo: "fixo" },
  { chave: "boleto_percentual", label: "Boleto (%)", tipo: "percentual" },
  { chave: "boleto_fixo", label: "Boleto — valor fixo (R$)", tipo: "fixo" },
] as const satisfies readonly { chave: keyof TaxasGateway; label: string; tipo: "percentual" | "fixo" }[];
