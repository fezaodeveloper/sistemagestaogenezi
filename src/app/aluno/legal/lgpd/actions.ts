"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigurado, enviarEmail } from "@/lib/resend/client";

const MENSAGEM_MAX_LENGTH = 2000;

export async function enviarSolicitacaoLgpd(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await requireRole("aluno");

  const tipo = String(formData.get("tipo") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();

  if (!tipo) {
    return { error: "Selecione o tipo de solicitação." };
  }
  if (!mensagem) {
    return { error: "Descreva sua solicitação." };
  }
  if (mensagem.length > MENSAGEM_MAX_LENGTH) {
    return { error: `A mensagem pode ter no máximo ${MENSAGEM_MAX_LENGTH} caracteres.` };
  }

  // Mesma filosofia best-effort de enviarEmail/enviarMensagemTelegram: sem
  // RESEND_API_KEY ou sem e-mail da escola configurado, a solicitação não é
  // perdida (o aluno já viu a mensagem de confirmação) — só não dispara o
  // e-mail. Uma fila/registro de solicitações fica pra uma versão futura,
  // se o volume justificar.
  if (await emailConfigurado()) {
    const supabase = await createClient();
    const { data: config } = await supabase
      .from("configuracoes")
      .select("escola_email")
      .eq("id", true)
      .maybeSingle();

    if (config?.escola_email) {
      await enviarEmail({
        to: config.escola_email,
        subject: `Solicitação LGPD: ${tipo}`,
        html: `<p><strong>Aluno:</strong> ${user.full_name ?? "—"} (${user.email ?? "—"})</p><p><strong>Tipo:</strong> ${tipo}</p><p><strong>Mensagem:</strong></p><p>${mensagem.replace(/\n/g, "<br>")}</p>`,
      });
    }
  }

  return { success: true };
}
