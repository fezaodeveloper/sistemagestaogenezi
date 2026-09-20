"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";
import { INTEGRAX_CONFIG_ID } from "@/lib/integrax/config";
import { enviarSMS, SMS_LIMITE_CARACTERES } from "@/lib/integrax/sms";

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
