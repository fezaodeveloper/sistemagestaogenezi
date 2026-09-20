import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { descriptografar } from "@/lib/gateways/crypto";
import { isGatewayTipo, type GatewayTipo, type TaxasGateway } from "@/lib/gateways/types";

// Leitura de gateways_config com o client ADMIN (service_role): webhooks e crons
// que cobram via Asaas não têm sessão de usuário. Quem expõe isso ao navegador
// (a tela de configuração) sempre passa por requireRole("admin") antes.

export type ConfigGateway = {
  gateway: GatewayTipo;
  ativo: boolean;
  sandbox: boolean;
  // Já descriptografadas. Credencial que não pôde ser lida (chave de
  // criptografia trocada/ausente) simplesmente não aparece aqui.
  credenciais: Record<string, string>;
  taxas: TaxasGateway;
};

type LinhaGateway = {
  gateway: string;
  ativo: boolean;
  sandbox: boolean;
  credenciais: Record<string, unknown> | null;
  taxas: Record<string, unknown> | null;
};

function lerCredenciais(bruto: Record<string, unknown> | null): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(bruto ?? {})) {
    if (typeof valor !== "string" || !valor) continue;
    try {
      const claro = descriptografar(valor);
      if (claro) resultado[chave] = claro;
    } catch {
      // Cifrado com outra chave (ou GATEWAYS_ENCRYPTION_KEY ausente): trata como
      // não preenchido em vez de derrubar a cobrança — o Asaas cai no fallback do ambiente.
    }
  }
  return resultado;
}

function lerTaxas(bruto: Record<string, unknown> | null): TaxasGateway {
  const taxas: TaxasGateway = {};
  for (const chave of ["pix_percentual", "cartao_percentual", "cartao_fixo", "boleto_percentual", "boleto_fixo"] as const) {
    const valor = bruto?.[chave];
    if (typeof valor === "number" && Number.isFinite(valor)) taxas[chave] = valor;
  }
  return taxas;
}

function paraConfig(linha: LinhaGateway): ConfigGateway | null {
  if (!isGatewayTipo(linha.gateway)) return null;
  return {
    gateway: linha.gateway,
    ativo: linha.ativo,
    sandbox: linha.sandbox,
    credenciais: lerCredenciais(linha.credenciais),
    taxas: lerTaxas(linha.taxas),
  };
}

export type LeituraConfigs = {
  configs: ConfigGateway[];
  // Preenchido quando a tabela não pôde ser lida (ex.: migration ainda não aplicada).
  erro: string | null;
};

// Sem cache: usado pela tela de configuração (sempre o estado real do banco).
export async function carregarConfigsGateways(): Promise<LeituraConfigs> {
  try {
    const { data, error } = await createAdminClient()
      .from("gateways_config")
      .select("gateway, ativo, sandbox, credenciais, taxas");
    if (error) return { configs: [], erro: error.message };
    const configs = ((data ?? []) as LinhaGateway[]).map(paraConfig).filter((c): c is ConfigGateway => c !== null);
    return { configs, erro: null };
  } catch (erro) {
    return { configs: [], erro: erro instanceof Error ? erro.message : "Falha ao ler gateways_config." };
  }
}

// Cache curto em memória, só pro caminho quente (cada chamada à API do Asaas
// precisa da chave): evita uma consulta ao banco por requisição. Vale por
// instância do servidor — depois de salvar na tela, outras instâncias enxergam a
// mudança em até TTL_CACHE_MS.
const TTL_CACHE_MS = 30_000;
const cache = new Map<GatewayTipo, { config: ConfigGateway | null; expiraEm: number }>();

export function invalidarCacheGateways(): void {
  cache.clear();
}

// null = sem linha para esse gateway OU tabela indisponível. Nos dois casos o
// chamador (adapter do Asaas) cai no fallback das variáveis de ambiente — é o que
// garante que o Asaas continue funcionando antes da migration ser aplicada.
export async function carregarConfigGateway(tipo: GatewayTipo): Promise<ConfigGateway | null> {
  const emCache = cache.get(tipo);
  if (emCache && emCache.expiraEm > Date.now()) return emCache.config;

  const { configs } = await carregarConfigsGateways();
  const config = configs.find((c) => c.gateway === tipo) ?? null;
  cache.set(tipo, { config, expiraEm: Date.now() + TTL_CACHE_MS });
  return config;
}
