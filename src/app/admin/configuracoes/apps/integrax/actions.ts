"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import { INTEGRAX_CONFIG_ID } from "@/lib/integrax/config";
import { enviarSMS, SMS_LIMITE_CARACTERES } from "@/lib/integrax/sms";
import { SMS_TEMPLATES, SMS_TEMPLATE_IDS, RECUPERACAO_PLACEHOLDERS, placeholdersDesconhecidos } from "@/lib/integrax/templates";
import {
  RECUPERACAO_CONFIG_ID,
  RECUPERACAO_HORAS_MIN,
  RECUPERACAO_MAX_ETAPAS,
  RECUPERACAO_PRAZO_MAX_DIAS,
  RECUPERACAO_PRAZO_MIN_DIAS,
  diasParaHoras,
} from "@/lib/integrax/recuperacao";

export type DadosIntegraxForm = {
  // Vazio = manter o token salvo (ele nunca volta pra tela).
  token: string;
  // true = apagar o token salvo.
  removerToken: boolean;
  ativo: boolean;
};

const dadosSchema = z.object({
  token: z.string().max(4000, { error: "Token longo demais." }),
  removerToken: z.boolean(),
  ativo: z.boolean(),
});

export async function salvarIntegrax(dadosBrutos: DadosIntegraxForm): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const supabase = await createClient();
  const { data: atual, error: erroLeitura } = await supabase
    .from("integracoes_sms_config")
    .select("token")
    .eq("id", INTEGRAX_CONFIG_ID)
    .maybeSingle();
  if (erroLeitura) {
    return { error: "Não foi possível ler a configuração. Confira se a migration integracoes_sms_config foi aplicada." };
  }

  // Token: novo valor -> criptografa; "remover" -> null; em branco -> mantém o salvo.
  const novoToken = dados.token.trim();
  let token: string | null = (atual?.token as string | null | undefined) ?? null;
  if (novoToken) {
    try {
      token = criptografar(novoToken);
    } catch (erro) {
      if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
      return { error: "Não foi possível proteger o token. Tente novamente." };
    }
  } else if (dados.removerToken) {
    token = null;
  }

  if (dados.ativo && !token) {
    return { error: "Informe o token da API antes de ativar a integração." };
  }

  const { error } = await supabase
    .from("integracoes_sms_config")
    .upsert({ id: INTEGRAX_CONFIG_ID, token, ativo: dados.ativo }, { onConflict: "id" });
  if (error) return { error: "Não foi possível salvar a integração. Tente novamente." };

  revalidatePath("/admin/configuracoes/apps/integrax");
  revalidatePath("/admin/configuracoes/apps");
  return { success: true };
}

const testeSchema = z.object({
  telefone: z.string().trim().min(1, { error: "Informe o telefone com DDD." }),
  mensagem: z
    .string()
    .trim()
    .min(1, { error: "Escreva a mensagem." })
    .max(SMS_LIMITE_CARACTERES, { error: `A mensagem pode ter no máximo ${SMS_LIMITE_CARACTERES} caracteres.` }),
});

// Envia de verdade com o token SALVO (mesmo com a integração desativada).
export async function enviarSmsTeste(telefone: string, mensagem: string): Promise<{ ok: boolean; erro?: string }> {
  await requireRole("admin");

  const parsed = testeSchema.safeParse({ telefone, mensagem });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const resultado = await enviarSMS(parsed.data.telefone, parsed.data.mensagem, { ignorarAtivo: true });
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro ?? "Não foi possível enviar o SMS." };
}

// ===== Templates de SMS (aba "Templates") =====

const templateSchema = z.object({
  id: z.enum(SMS_TEMPLATE_IDS, { error: "Template inválido." }),
  mensagem: z
    .string()
    .trim()
    .min(1, { error: "Escreva a mensagem." })
    .max(SMS_LIMITE_CARACTERES, { error: `A mensagem pode ter no máximo ${SMS_LIMITE_CARACTERES} caracteres.` }),
  ativo: z.boolean(),
});

// Salva (ou atualiza) um template. `ativo` desligado = o sistema usa a mensagem padrão do código
// (o SMS continua sendo enviado).
export async function salvarTemplateSms(dados: {
  id: string;
  mensagem: string;
  ativo: boolean;
}): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  const parsed = templateSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, mensagem, ativo } = parsed.data;

  const definicao = SMS_TEMPLATES[id];
  const chaves = definicao.placeholders.map((p) => p.chave);
  const desconhecidos = placeholdersDesconhecidos(mensagem, chaves);
  if (desconhecidos.length > 0) {
    return { error: `Placeholder desconhecido: ${desconhecidos.map((c) => `{${c}}`).join(", ")}. Use só os da lista.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sms_templates")
    .upsert({ id, nome: definicao.nome, mensagem, ativo, variaveis: chaves }, { onConflict: "id" });
  if (error) return { error: "Não foi possível salvar o template. Confira se a migration sms_templates foi aplicada." };

  revalidatePath("/admin/configuracoes/apps/integrax");
  return { success: true };
}

// ===== Recuperação escalonada (aba "Recuperação Escalonada") =====

export type DadosRecuperacaoForm = {
  ativo: boolean;
  // 1 a 7 (a tela trabalha em dias; o banco guarda horas).
  prazoDias: number;
  etapas: { horas: number; mensagem: string }[];
};

const recuperacaoSchema = z.object({
  ativo: z.boolean(),
  prazoDias: z
    .number()
    .int({ error: "O prazo deve ser em dias inteiros." })
    .min(RECUPERACAO_PRAZO_MIN_DIAS, { error: `O prazo mínimo é ${RECUPERACAO_PRAZO_MIN_DIAS} dia.` })
    .max(RECUPERACAO_PRAZO_MAX_DIAS, { error: `O prazo máximo é ${RECUPERACAO_PRAZO_MAX_DIAS} dias.` }),
  etapas: z
    .array(
      z.object({
        horas: z.number().int({ error: "Informe as horas em número inteiro." }).min(RECUPERACAO_HORAS_MIN, { error: "Cada etapa precisa de pelo menos 1 hora." }),
        mensagem: z
          .string()
          .trim()
          .min(1, { error: "Escreva a mensagem de cada etapa." })
          .max(SMS_LIMITE_CARACTERES, { error: `Cada mensagem pode ter no máximo ${SMS_LIMITE_CARACTERES} caracteres.` }),
      }),
    )
    .max(RECUPERACAO_MAX_ETAPAS, { error: `No máximo ${RECUPERACAO_MAX_ETAPAS} etapas.` }),
});

export async function salvarRecuperacaoSms(dadosBrutos: DadosRecuperacaoForm): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  const parsed = recuperacaoSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { ativo, prazoDias, etapas } = parsed.data;

  const prazoHoras = diasParaHoras(prazoDias);
  const chaves = RECUPERACAO_PLACEHOLDERS.map((p) => p.chave);

  const ordenadas = [...etapas].sort((a, b) => a.horas - b.horas);
  for (const [indice, etapa] of ordenadas.entries()) {
    if (etapa.horas > prazoHoras) {
      return { error: `A etapa de ${etapa.horas}h passa do prazo de ${prazoDias} ${prazoDias === 1 ? "dia" : "dias"}. Aumente o prazo ou reduza as horas.` };
    }
    if (indice > 0 && etapa.horas === ordenadas[indice - 1].horas) {
      return { error: `Há duas etapas em ${etapa.horas}h. Use horários diferentes.` };
    }
    const desconhecidos = placeholdersDesconhecidos(etapa.mensagem, chaves);
    if (desconhecidos.length > 0) {
      return { error: `Placeholder desconhecido na etapa de ${etapa.horas}h: ${desconhecidos.map((c) => `{${c}}`).join(", ")}.` };
    }
  }
  if (ativo && ordenadas.length === 0) return { error: "Adicione pelo menos uma etapa antes de ativar." };

  const supabase = await createClient();
  const { data: atual, error: erroLeitura } = await supabase
    .from("sms_recuperacao_config")
    .select("ativo, ativado_em")
    .eq("id", RECUPERACAO_CONFIG_ID)
    .maybeSingle();
  if (erroLeitura) return { error: "Não foi possível ler a configuração. Confira se a migration sms_templates foi aplicada." };

  // Marca o momento em que foi LIGADA: o cron só considera leads cadastrados depois disso (ligar
  // não dispara SMS para leads antigos).
  const ativadoEm = ativo && atual?.ativo !== true ? new Date().toISOString() : ((atual?.ativado_em as string | null | undefined) ?? null);

  const { error } = await supabase.from("sms_recuperacao_config").upsert(
    { id: RECUPERACAO_CONFIG_ID, ativo, prazo_maximo_horas: prazoHoras, etapas: ordenadas, ativado_em: ativadoEm },
    { onConflict: "id" },
  );
  if (error) return { error: "Não foi possível salvar a recuperação. Tente novamente." };

  revalidatePath("/admin/configuracoes/apps/integrax");
  return { success: true };
}
