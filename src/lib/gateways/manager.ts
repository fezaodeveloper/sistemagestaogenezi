import "server-only";

import { AsaasAdapter, asaasTemChaveNoAmbiente, montarConfigAsaas } from "@/lib/gateways/adapters/asaas";
import { EfiAdapter } from "@/lib/gateways/adapters/efi";
import { MercadoPagoAdapter } from "@/lib/gateways/adapters/mercadopago";
import { PagarmeAdapter } from "@/lib/gateways/adapters/pagarme";
import { StripeAdapter, type StripeConfig } from "@/lib/gateways/adapters/stripe";
import { GATEWAYS_CATALOGO, type CampoCredencial } from "@/lib/gateways/catalogo";
import { carregarConfigGateway, carregarConfigsGateways, type ConfigGateway } from "@/lib/gateways/config";
import {
  GATEWAY_TIPOS,
  GatewayTipo,
  type GatewayAdapter,
  type MetodoPagamento,
  type TaxasGateway,
} from "@/lib/gateways/types";

// Ponto único pra obter o adapter de um gateway. O resto do sistema não deve
// instanciar adapters diretamente.

// Constrói o adapter a partir de uma config (do banco, ou montada na hora pra
// "Testar conexão" com o que o admin digitou e ainda não salvou).
export function criarAdapter(tipo: GatewayTipo, config: ConfigGateway | null): GatewayAdapter {
  switch (tipo) {
    case GatewayTipo.Asaas:
      return new AsaasAdapter(montarConfigAsaas(config?.credenciais.apiKey, config?.sandbox ?? false));
    case GatewayTipo.Stripe:
      return new StripeAdapter(montarConfigStripe(config));
    case GatewayTipo.Pagarme:
      return new PagarmeAdapter();
    case GatewayTipo.Mercadopago:
      return new MercadoPagoAdapter();
    case GatewayTipo.Efi:
      return new EfiAdapter();
  }
}

export function montarConfigStripe(config: ConfigGateway | null): StripeConfig {
  return {
    secretKey: config?.credenciais.secretKey ?? "",
    publishableKey: config?.credenciais.publishableKey ?? "",
    webhookSecret: config?.credenciais.webhookSecret ?? "",
  };
}

export async function getAdapter(tipo: GatewayTipo): Promise<GatewayAdapter> {
  return criarAdapter(tipo, await carregarConfigGateway(tipo));
}

// Adapter do gateway marcado como ativo=true. Sem nenhum ativo (ou com a tabela
// gateways_config ainda indisponível) devolve o do Asaas — o gateway que o
// sistema sempre usou —, em vez de deixar o financeiro sem cobrança.
export async function getGatewayAtivo(): Promise<GatewayAdapter> {
  const { configs } = await carregarConfigsGateways();
  const ativo = configs.find((config) => config.ativo);
  return criarAdapter(ativo?.gateway ?? GatewayTipo.Asaas, ativo ?? null);
}

// ===== Listagem (tela /admin/configuracoes/gateways) =====

export type CampoResumo = CampoCredencial & {
  // Segredo já salvo: só o booleano vai pro navegador, nunca o valor.
  preenchido: boolean;
  // Valor atual dos campos NÃO secretos (ex.: chave pública), pra pré-preencher.
  valor?: string;
};

export type OrigemCredenciais = "banco" | "ambiente" | "nenhuma";

export type GatewayResumo = {
  tipo: GatewayTipo;
  nome: string;
  cor: string;
  descricao: string;
  metodos: readonly MetodoPagamento[];
  implementado: boolean;
  ativo: boolean;
  sandbox: boolean;
  // "Conectado" = credenciais obrigatórias preenchidas (não é um teste ao vivo —
  // pra isso existe o botão "Testar conexão").
  conectado: boolean;
  origemCredenciais: OrigemCredenciais;
  campos: CampoResumo[];
  taxas: TaxasGateway;
};

export function credenciaisCompletas(tipo: GatewayTipo, credenciais: Record<string, string>): boolean {
  return GATEWAYS_CATALOGO[tipo].campos.filter((campo) => campo.obrigatorio).every((campo) => !!credenciais[campo.chave]);
}

function resumir(tipo: GatewayTipo, config: ConfigGateway | undefined): GatewayResumo {
  const catalogo = GATEWAYS_CATALOGO[tipo];
  const credenciais = config?.credenciais ?? {};
  const noBanco = credenciaisCompletas(tipo, credenciais);
  // Asaas sem chave salva continua funcionando pela variável de ambiente.
  const noAmbiente = tipo === GatewayTipo.Asaas && !noBanco && asaasTemChaveNoAmbiente();

  return {
    tipo,
    nome: catalogo.nome,
    cor: catalogo.cor,
    descricao: catalogo.descricao,
    metodos: catalogo.metodos,
    implementado: catalogo.implementado,
    ativo: config?.ativo ?? false,
    sandbox: config?.sandbox ?? false,
    conectado: noBanco || noAmbiente,
    origemCredenciais: noBanco ? "banco" : noAmbiente ? "ambiente" : "nenhuma",
    campos: catalogo.campos.map((campo) => ({
      ...campo,
      preenchido: !!credenciais[campo.chave],
      valor: campo.secreto ? undefined : credenciais[campo.chave],
    })),
    taxas: config?.taxas ?? {},
  };
}

// Todos os gateways do catálogo (existam ou não na tabela) com o status atual.
// `erro` vem preenchido se a tabela não pôde ser lida (ex.: migration pendente).
export async function listarGatewaysComAviso(): Promise<{ gateways: GatewayResumo[]; erro: string | null }> {
  const { configs, erro } = await carregarConfigsGateways();
  const gateways = GATEWAY_TIPOS.map((tipo) => resumir(tipo, configs.find((config) => config.gateway === tipo)));
  return { gateways, erro };
}

export async function listarGateways(): Promise<GatewayResumo[]> {
  return (await listarGatewaysComAviso()).gateways;
}
