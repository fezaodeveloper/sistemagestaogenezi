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
  // Campo preenchido escolhendo um arquivo (ex.: certificado .p12): a tela lê o
  // arquivo e guarda o conteúdo em base64.
  arquivoBase64?: boolean;
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
    descricao: "PIX direto com QR Code; cartão e boleto pela página de pagamento do Mercado Pago.",
    metodos: ["pix", "cartao", "boleto"],
    implementado: true,
    campos: [
      { chave: "accessToken", label: "Access Token", secreto: true, obrigatorio: true, placeholder: "APP_USR-..." },
      { chave: "publicKey", label: "Public Key", secreto: false, obrigatorio: true, placeholder: "APP_USR-..." },
      {
        chave: "webhookSecret",
        label: "Assinatura secreta do webhook",
        secreto: true,
        obrigatorio: true,
        ajuda:
          "Em Suas integrações > Webhooks do Mercado Pago, cadastre https://sistemagestaogenezi.vercel.app/api/webhooks/mercadopago com o evento Pagamentos e cole aqui a assinatura secreta gerada.",
      },
    ],
  },
  [GatewayTipo.Efi]: {
    tipo: GatewayTipo.Efi,
    nome: "Efí (Gerencianet)",
    cor: "#F37021",
    descricao: "PIX imediato com QR Code, boleto e cartão (pelo link de pagamento da Efí).",
    metodos: ["pix", "cartao", "boleto"],
    implementado: true,
    campos: [
      {
        chave: "clientId",
        label: "Client ID",
        secreto: false,
        obrigatorio: true,
        ajuda: "Produção e homologação têm credenciais diferentes: use as do ambiente que o modo sandbox indica.",
      },
      { chave: "clientSecret", label: "Client Secret", secreto: true, obrigatorio: true },
      {
        chave: "chavePix",
        label: "Chave PIX",
        secreto: false,
        obrigatorio: false,
        ajuda: "Necessária para gerar cobranças PIX (a chave cadastrada na sua conta Efí).",
      },
      {
        chave: "certificadoP12",
        label: "Certificado .p12",
        secreto: true,
        obrigatorio: false,
        arquivoBase64: true,
        ajuda:
          "A API Pix da Efí exige o certificado em TODA chamada (autenticação mTLS), não só no cartão. Sem ele só boleto e cartão funcionam. Ao salvar com tudo preenchido, o webhook PIX é cadastrado na Efí automaticamente.",
      },
      {
        chave: "payeeCode",
        label: "Payee Code (opcional)",
        secreto: false,
        obrigatorio: false,
        ajuda: "Só é usado por cartão tokenizado no navegador; o link de pagamento usado aqui não precisa.",
      },
    ],
  },
};

export function getCatalogoGateway(tipo: GatewayTipo): GatewayCatalogoItem {
  return GATEWAYS_CATALOGO[tipo];
}
