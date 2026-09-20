"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { GATEWAYS_CATALOGO } from "@/lib/gateways/catalogo";
import { carregarConfigsGateways, invalidarCacheGateways, type ConfigGateway } from "@/lib/gateways/config";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import { asaasTemChaveNoAmbiente } from "@/lib/gateways/adapters/asaas";
import { EfiAdapter } from "@/lib/gateways/adapters/efi";
import { credenciaisCompletas, criarAdapter, montarConfigEfi } from "@/lib/gateways/manager";
import { GatewayTipo, TAXA_CAMPOS, isGatewayTipo, type ResultadoTesteConexao, type TaxasGateway } from "@/lib/gateways/types";

export type DadosGatewayForm = {
  ativo: boolean;
  sandbox: boolean;
  // Só os campos digitados. Vazio = manter o valor já salvo.
  credenciais: Record<string, string>;
  // Texto como digitado (aceita vírgula decimal); vazio = sem taxa.
  taxas: Record<string, string>;
};

export type SalvarGatewayResultado = { success: true } | { error: string };

const CREDENCIAL_MAXIMO = 60_000; // cabe um certificado .p12 em base64

const dadosSchema = z.object({
  ativo: z.boolean(),
  sandbox: z.boolean(),
  credenciais: z.record(z.string(), z.string().max(CREDENCIAL_MAXIMO, { error: "Credencial longa demais." })),
  taxas: z.record(z.string(), z.string()),
});

function parseTaxas(entrada: Record<string, string>): { taxas: TaxasGateway } | { error: string } {
  const taxas: TaxasGateway = {};
  for (const campo of TAXA_CAMPOS) {
    const texto = (entrada[campo.chave] ?? "").trim().replace(",", ".");
    if (!texto) continue;
    const numero = Number(texto);
    const limite = campo.tipo === "percentual" ? 100 : 10_000;
    if (!Number.isFinite(numero) || numero < 0 || numero > limite) {
      return { error: `Taxa inválida em "${campo.label}": informe um número entre 0 e ${limite}.` };
    }
    taxas[campo.chave] = numero;
  }
  return { taxas };
}

// Mistura o que o admin digitou com o que já está salvo (já descriptografado):
// campo em branco mantém o valor salvo.
function mesclarCredenciais(
  tipo: GatewayTipo,
  existentes: Record<string, string>,
  digitadas: Record<string, string>,
): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const campo of GATEWAYS_CATALOGO[tipo].campos) {
    const novo = (digitadas[campo.chave] ?? "").trim();
    const valor = novo || existentes[campo.chave];
    if (valor) resultado[campo.chave] = valor;
  }
  return resultado;
}

// Salva (cria ou atualiza) a configuração de um gateway. Ativar um gateway
// desativa o que estava ativo (o banco também garante no máximo um, por índice
// único parcial).
export async function salvarGateway(tipoBruto: string, dadosBrutos: DadosGatewayForm): Promise<SalvarGatewayResultado> {
  await requireRole("admin");

  if (!isGatewayTipo(tipoBruto)) return { error: "Gateway inválido." };
  const tipo = tipoBruto;
  const catalogo = GATEWAYS_CATALOGO[tipo];

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const resultadoTaxas = parseTaxas(dados.taxas);
  if ("error" in resultadoTaxas) return resultadoTaxas;

  const { configs, erro: erroLeitura } = await carregarConfigsGateways();
  if (erroLeitura) {
    return { error: "Não foi possível ler a configuração dos gateways. Confira se a migration gateways_config foi aplicada." };
  }
  const existente = configs.find((config) => config.gateway === tipo);
  const anteriorAtivo = configs.find((config) => config.ativo && config.gateway !== tipo);

  const credenciais = mesclarCredenciais(tipo, existente?.credenciais ?? {}, dados.credenciais);

  if (dados.ativo) {
    if (!catalogo.implementado) {
      return { error: `A integração com ${catalogo.nome} ainda não está disponível — não é possível ativá-lo.` };
    }
    const completas = credenciaisCompletas(tipo, credenciais) || (tipo === GatewayTipo.Asaas && asaasTemChaveNoAmbiente());
    if (!completas) {
      return { error: "Preencha as credenciais obrigatórias antes de ativar o gateway." };
    }
  }

  // Só o que o admin acabou de digitar precisa ser cifrado; o que veio do banco
  // é regravado (cifrado de novo, com IV novo) — uniformiza tudo no formato atual.
  let credenciaisCifradas: Record<string, string>;
  try {
    credenciaisCifradas = Object.fromEntries(Object.entries(credenciais).map(([chave, valor]) => [chave, criptografar(valor)]));
  } catch (erro) {
    if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
    return { error: "Não foi possível proteger as credenciais. Tente novamente." };
  }

  const supabase = await createClient();

  // O índice único parcial recusa dois ativos ao mesmo tempo: o antigo sai antes.
  if (dados.ativo && anteriorAtivo) {
    const { error } = await supabase.from("gateways_config").update({ ativo: false }).eq("gateway", anteriorAtivo.gateway).eq("ativo", true);
    if (error) return { error: "Não foi possível desativar o gateway atual. Nada foi alterado." };
  }

  const linha = {
    gateway: tipo,
    ativo: dados.ativo,
    sandbox: dados.sandbox,
    credenciais: credenciaisCifradas,
    taxas: resultadoTaxas.taxas,
  };
  const { error } = await supabase.from("gateways_config").upsert(linha, { onConflict: "gateway" });

  if (error) {
    // Falhou depois de desativar o anterior: devolve o estado de antes.
    if (dados.ativo && anteriorAtivo) {
      await restaurarAtivo(anteriorAtivo);
    }
    return { error: "Não foi possível salvar o gateway. Tente novamente." };
  }

  invalidarCacheGateways();
  revalidatePath("/admin/configuracoes/gateways");

  // Efí: o webhook PIX precisa ser cadastrado na conta deles (PUT /v2/webhook/:chave).
  // Feito aqui, ao salvar com tudo preenchido, pra o admin não ter que chamar a API à mão.
  if (tipo === GatewayTipo.Efi && credenciais.clientId && credenciais.clientSecret && credenciais.certificadoP12 && credenciais.chavePix) {
    try {
      await new EfiAdapter(
        montarConfigEfi({ gateway: tipo, ativo: dados.ativo, sandbox: dados.sandbox, credenciais, taxas: resultadoTaxas.taxas }),
      ).registrarWebhookPix();
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "erro desconhecido";
      return { error: `Configuração salva, mas não foi possível cadastrar o webhook PIX na Efí: ${motivo}` };
    }
  }

  return { success: true };
}

async function restaurarAtivo(config: ConfigGateway): Promise<void> {
  const supabase = await createClient();
  await supabase.from("gateways_config").update({ ativo: true }).eq("gateway", config.gateway);
}

// "Testar conexão" usa o que está no formulário (mesclado com o já salvo), sem
// precisar salvar antes.
export async function testarConexaoGateway(tipoBruto: string, dadosBrutos: DadosGatewayForm): Promise<ResultadoTesteConexao> {
  await requireRole("admin");

  if (!isGatewayTipo(tipoBruto)) return { ok: false, erro: "Gateway inválido." };
  const tipo = tipoBruto;

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { configs } = await carregarConfigsGateways();
  const existente = configs.find((config) => config.gateway === tipo);

  const config: ConfigGateway = {
    gateway: tipo,
    ativo: false,
    sandbox: parsed.data.sandbox,
    credenciais: mesclarCredenciais(tipo, existente?.credenciais ?? {}, parsed.data.credenciais),
    taxas: {},
  };

  try {
    return await criarAdapter(tipo, config).testarConexao();
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha ao testar a conexão." };
  }
}
