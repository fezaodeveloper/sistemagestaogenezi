"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarRecuperacaoSenha } from "@/lib/resend/emails";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app").replace(/\/+$/, "");

// Gera o link de recovery pela Admin API (service_role) em vez de depender do e-mail nativo do
// Supabase Auth — assim o envio passa pelo template editável em /admin/configuracoes/email
// (id "recuperacao_senha"), não pelo e-mail fixo do painel do Supabase.
//
// O link é montado a partir de hashed_token, NÃO do action_link cru devolvido por generateLink:
// action_link aponta pro endpoint hospedado do Supabase (auth/v1/verify), que o Chrome passou a
// bloquear como "bounce tracking protection" — mesmo motivo já documentado em
// src/components/auth/nova-senha-form.tsx e em src/app/api/webhooks/asaas-conecta/route.ts.
// Construindo /nova-senha?token_hash=...&type=recovery direto, o verifyOtp que o
// NovaSenhaForm já faz no client funciona sem esse salto.
//
// Nunca revela se o e-mail existe (mesma regra de segurança do fluxo anterior com
// resetPasswordForEmail, que também nunca revelava) — por isso sempre retorna {ok: true},
// mesmo quando o e-mail não está cadastrado ou o envio falha.
export async function solicitarRecuperacaoSenhaAction(email: string): Promise<{ ok: boolean; erro?: string }> {
  const emailNormalizado = email.trim();
  if (!emailNormalizado) return { ok: true };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: emailNormalizado,
      options: { redirectTo: `${SITE_URL}/nova-senha` },
    });

    const hashedToken = data?.properties?.hashed_token;
    if (error || !hashedToken) {
      // E-mail não cadastrado (ou outra falha) — não revela ao chamador.
      return { ok: true };
    }

    const recoveryLink = `${SITE_URL}/nova-senha?token_hash=${hashedToken}&type=recovery`;

    const { data: perfil } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    await enviarRecuperacaoSenha(emailNormalizado, perfil?.full_name ?? emailNormalizado, recoveryLink);
    return { ok: true };
  } catch (erro) {
    console.error("[recuperar-senha] falha ao gerar link de recovery", erro);
    return { ok: true };
  }
}
