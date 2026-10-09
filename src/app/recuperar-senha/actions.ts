"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type RecuperarSenhaState = { error?: string; sucesso?: string } | undefined;

const schema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
});

// Mesmo fallback já usado em outros pontos do código pra essa mesma variável
// (ver src/lib/email/eventos.ts e outros) — sem NEXT_PUBLIC_SITE_URL
// configurada, cai no domínio da Vercel em vez de quebrar o link.
const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

// Mensagem de sucesso é SEMPRE a mesma, exista ou não conta com esse e-mail — e também quando o
// próprio Supabase erra (ex.: rate limit). Responder diferente conforme o e-mail existe ou não
// permitiria enumerar contas cadastradas só tentando "esqueci minha senha" repetidas vezes.
const MENSAGEM_SUCESSO = "Se este e-mail estiver cadastrado, você receberá um link em instantes.";

export async function enviarLinkRecuperacaoSenha(
  _prevState: RecuperarSenhaState,
  formData: FormData,
): Promise<RecuperarSenhaState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/nova-senha`,
  });

  if (error) {
    // Logado só pra diagnóstico operacional (ex.: rate limit do Supabase) — nunca repassado ao
    // formulário, pelo mesmo motivo da mensagem genérica acima.
    console.error("[recuperar-senha] erro ao pedir reset:", error.message);
  }

  return { sucesso: MENSAGEM_SUCESSO };
}
