"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { lerConfigSenhaPortal } from "@/lib/portal-login/config";
import { createClient } from "@/lib/supabase/server";

export type LinkAcessoState = { error?: string; sucesso?: string } | undefined;

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

const MENSAGEM_ENVIADO =
  "Se este e-mail estiver cadastrado, enviamos um link de acesso. Confira a sua caixa de entrada (e o spam).";

// Login "somente e-mail": envia um link de acesso (magic link) por e-mail. Sem
// requireRole de propósito — a tela de login é pública.
//
// A resposta é a MESMA exista o e-mail ou não (senão a tela serviria pra descobrir quem
// é aluno), e shouldCreateUser:false garante que um e-mail desconhecido nunca vira conta.
export async function enviarLinkDeAcesso(_prev: LinkAcessoState, formData: FormData): Promise<LinkAcessoState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Informe um e-mail válido." };

  // Só funciona se o portal está configurado como "somente e-mail".
  if ((await lerConfigSenhaPortal()).tipo !== "so_email") {
    return { error: "Este portal usa e-mail e senha para entrar." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      // O callback troca o link por sessão e leva o aluno pra área dele.
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=/aluno`,
    },
  });

  // Limite de envios do Supabase: avisa (não revela nada sobre o e-mail).
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  if (error) console.error("[entrar] falha ao enviar o link de acesso:", error.message);

  return { sucesso: MENSAGEM_ENVIADO };
}
