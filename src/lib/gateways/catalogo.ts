import { GatewayTipo, type MetodoPagamento } from "@/lib/gateways/types";

// Metadados de cada gateway: nome, métodos, e os campos de credencial que a tela
// de configuração pede. Sem segredos — pode ser importado por client components.

export type CampoCredencial = {
  chave: string;
  label: string;
  // Segredo: nunca volta pro navegador depois de salvo (a tela mostra só "preenchido").
  secreto: boolean;
  obrigatorio: boolean;
  placeholder?: string;
  ajuda?: string;
  multilinha?: boolean;
};

export type GatewayCatalogoItem = {
  tipo: GatewayTipo;
  nome: string;
  // Cor da marca, usada no "logo" do card.
  cor: string;
  descricao: string;
  metodos: readonly MetodoPagamento[];
  // false = adapter ainda é stub (próximas fases): dá pra guardar credenciais,
  // mas não ativar o gateway.
  implementado: boolean;
  campos: readonly CampoCredencial[];
};

export const GATEWAYS_CATALOGO: Record<GatewayTipo, GatewayCatalogoItem> = {
  [GatewayTipo.Asaas]: {
    tipo: GatewayTipo.Asaas,
    nome: "Asaas",
    cor: "#0F62FE",
    descricao: "Boleto, PIX e cartão com conciliação automática. Gateway em uso hoje na escola.",
    metodos: ["pix", "cartao", "boleto"],
    implementado: true,
    campos: [
      {
        chave: "apiKey",
        label: "API Key",
        secreto: true,
        obrigatorio: true,
        placeholder: "$aact_...",
        ajuda:
          "Vazio = o sistema continua usando a chave da variável de ambiente ASAAS_API_KEY. Preencha para passar a usar a chave guardada aqui.",
      },
    ],
  },
  [GatewayTipo.Stripe]: {
    tipo: GatewayTipo.Stripe,
    nome: "Stripe",
    cor: "#635BFF",
    descricao: "Cartão de crédito e PIX, com página de pagamento hospedada pelo Stripe.",
    metodos: ["pix", "cartao"],
    implementado: true,
    campos: [
      {
        chave: "secretKey",
        label: "Secret Key",
        secreto: true,
        obrigatorio: true,
        placeholder: "sk_live_...",
        ajuda: "A chave do modo teste (sk_test_...) e a do modo real (sk_live_...) são independentes.",
      },
      { chave: "publishableKey", label: "Publishable Key", secreto: false, obrigatorio: true, placeholder: "pk_live_..." },
      {
        chave: "webhookSecret",
        label: "Webhook Secret",
        secreto: true,
        obrigatorio: true,
        placeholder: "whsec_...",
        ajuda:
          "No painel do Stripe, cadastre o endpoint https://sistemagestaogenezi.vercel.app/api/webhooks/stripe com os eventos payment_intent.succeeded, payment_intent.payment_failed e payment_intent.canceled.",
      },
    ],
  },
  [GatewayTipo.Pagarme]: {
    tipo: GatewayTipo.Pagarme,
    nome: "Pagar.me",
    cor: "#65A300",
    descricao: "Cartão (página de pagamento hospedada), PIX e boleto.",
    metodos: ["pix", "cartao", "boleto"],
    implementado: true,
    campos: [
      {
        chave: "secretKey",
        label: "Secret Key",
        secreto: true,
        obrigatorio: true,
        placeholder: "sk_...",
        ajuda:
          "É também a chave que assina os webhooks. No painel do Pagar.me, cadastre o endpoint https://sistemagestaogenezi.vercel.app/api/webhooks/pagarme com os eventos charge.paid, charge.payment_failed, charge.canceled e charge.refunded.",
      },
      { chave: "publicKey", label: "Public Key", secreto: false, obrigatorio: true, placeholder: "pk_..." },
    ],
  },
  [GatewayTipo.Mercadopago]: {
    tipo: GatewayTipo.Mercadopago,
    nome: "Mercado Pago",
    cor: "#00A8E8",
    descricao: "Cartão, PIX e boleto.",
    metodos: ["pix", "cartao", "boleto"],
    implementado: false,
    campos: [
      { chave: "accessToken", label: "Access Token", secreto: true, obrigatorio: true, placeholder: "APP_USR-..." },
      { chave: "publicKey", label: "Public Key", secreto: false, obrigatorio: false, placeholder: "APP_USR-..." },
    ],
  },
  [GatewayTipo.Efi]: {
    tipo: GatewayTipo.Efi,
    nome: "Efí (Gerencianet)",
    cor: "#F37021",
    descricao: "PIX e boleto.",
    metodos: ["pix", "boleto"],
    implementado: false,
    campos: [
      { chave: "clientId", label: "Client ID", secreto: false, obrigatorio: true },
      { chave: "clientSecret", label: "Client Secret", secreto: true, obrigatorio: true },
      { chave: "chavePix", label: "Chave PIX", secreto: false, obrigatorio: false },
      {
        chave: "certificado",
        label: "Certificado (.p12 em base64)",
        secreto: true,
        obrigatorio: false,
        multilinha: true,
        ajuda: "Conteúdo do certificado .p12 codificado em base64.",
      },
    ],
  },
};

export function getCatalogoGateway(tipo: GatewayTipo): GatewayCatalogoItem {
  return GATEWAYS_CATALOGO[tipo];
}
