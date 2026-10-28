import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarAcessoConecta } from "@/lib/resend/emails";
import { enviarWhatsApp } from "@/lib/whatsapp/enviar";

const URL_SITE_PADRAO = "https://escola.genezi.com.br";

function urlPortal(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

export type ResultadoAcessoConecta = { emailOk: boolean; whatsappOk: boolean; erro: string | null };

// Extraído do webhook asaas-conecta (TAREFA: candidato pago sem acesso) pra ser reaproveitado
// também pelo botão "Reenviar acesso" do admin (src/app/admin/conecta/candidatos/actions.ts) —
// mesma lógica, dois pontos de entrada (automático no webhook, manual quando o admin precisa
// corrigir um caso que travou). Nunca lança: cada canal (email/WhatsApp) é best-effort
// independente, mas aqui o resultado de cada um é devolvido (não engolido em silêncio) pra quem
// chamar poder registrar a falha em log_webhooks_conecta.erro em vez de só assumir sucesso.
export async function enviarAcessoConectaCandidato(perfil: {
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  plano: string | null;
}): Promise<ResultadoAcessoConecta> {
  if (!perfil.email) {
    return { emailOk: false, whatsappOk: false, erro: "Perfil sem e-mail cadastrado." };
  }

  const admin = createAdminClient();
  const nome = perfil.nome ?? "candidato";
  const plano = perfil.plano ?? "—";

  let recoveryLink: string | null = null;
  try {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: perfil.email,
      options: { redirectTo: `${urlPortal()}/conecta/criar-senha` },
    });

    const hashedToken = linkData?.properties?.hashed_token;
    if (hashedToken) {
      // action_link cru do generateLink aponta pro endpoint hospedado do próprio Supabase
      // (auth/v1/verify) e devolve os tokens de sessão no FRAGMENTO da URL, invisível pro nosso
      // /auth/callback (Route Handler server-side) — construindo direto com token_hash+type na
      // query string, o verifyOtp de lá funciona de verdade.
      recoveryLink = `${urlPortal()}/auth/callback?token_hash=${hashedToken}&type=recovery`;
    }
  } catch {
    // erro tratado abaixo pelo recoveryLink nulo.
  }

  if (!recoveryLink) {
    return { emailOk: false, whatsappOk: false, erro: "Não foi possível gerar o link de acesso (generateLink falhou)." };
  }

  const emailOk = await enviarAcessoConecta(perfil.email, nome, recoveryLink, plano);

  let whatsappOk = false;
  if (perfil.whatsapp) {
    const mensagem = [
      `🎉 Olá, ${nome}!`,
      "",
      `Seu pagamento foi confirmado e seu plano ${plano} no Gênezi Conecta está ativo.`,
      "",
      `Crie sua senha de acesso aqui: ${recoveryLink}`,
      "",
      "O link expira em 24 horas.",
    ].join("\n");

    try {
      const resultado = await enviarWhatsApp(perfil.whatsapp, mensagem);
      whatsappOk = resultado.ok;
    } catch {
      whatsappOk = false;
    }
  }

  const falhas: string[] = [];
  if (!emailOk) falhas.push("email");
  if (perfil.whatsapp && !whatsappOk) falhas.push("WhatsApp");

  return { emailOk, whatsappOk, erro: falhas.length > 0 ? `Falha ao enviar acesso por: ${falhas.join(", ")}.` : null };
}
