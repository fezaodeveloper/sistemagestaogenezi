import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, resendConfigurado } from "@/lib/resend/client";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const PREMIOS_DIGITAIS_BUCKET = "premios-digitais";
// Link de download no email de entrega — validade maior que os signed URLs
// "de sessão" do projeto (ex.: 10min pro visualizador de PDF/NF), porque
// aqui é um link que o aluno pode só abrir dias depois de receber o email.
const ENTREGA_ARQUIVO_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 dias

type PremioParaEntrega = {
  nome: string;
  entrega_email_conteudo: string | null;
  entrega_arquivo_path: string | null;
};

// Monta o corpo (substitui variáveis + anexa link de download, se houver
// arquivo) e envia via Resend, atualizando o status da entrega conforme o
// resultado. Compartilhado entre o envio inicial (ao resgatar, ver
// src/app/aluno/creditos/actions.ts) e o reenvio manual pelo admin (ver
// src/app/admin/resgates/actions.ts) — mesma lógica, duas origens.
export async function enviarEmailEntregaPremio(
  admin: SupabaseAdminClient,
  entregaId: string,
  premio: PremioParaEntrega,
  alunoEmail: string | null,
  nomeAluno: string,
): Promise<{ error?: string }> {
  if (!premio.entrega_email_conteudo) {
    return { error: "Este prêmio não tem conteúdo de email de entrega configurado." };
  }
  if (!resendConfigurado()) {
    await admin
      .from("entregas_premios")
      .update({ status: "falhou", observacoes: "RESEND_API_KEY não configurado" })
      .eq("id", entregaId);
    return { error: "RESEND_API_KEY não configurado — não é possível enviar o email." };
  }
  if (!alunoEmail) {
    await admin
      .from("entregas_premios")
      .update({ status: "falhou", observacoes: "Aluno sem email cadastrado" })
      .eq("id", entregaId);
    return { error: "Este aluno não tem email cadastrado." };
  }

  let corpoEmail = premio.entrega_email_conteudo
    .replaceAll("{nome_aluno}", nomeAluno)
    .replaceAll("{nome_premio}", premio.nome);

  if (premio.entrega_arquivo_path) {
    const { data: signed } = await admin.storage
      .from(PREMIOS_DIGITAIS_BUCKET)
      .createSignedUrl(premio.entrega_arquivo_path, ENTREGA_ARQUIVO_EXPIRES_IN);
    if (signed) {
      corpoEmail += `<p><a href="${signed.signedUrl}">Clique aqui para baixar o seu arquivo</a></p>`;
    }
  }

  const enviado = await enviarEmail({
    to: alunoEmail,
    subject: `🎁 Seu prêmio chegou! ${premio.nome}`,
    html: corpoEmail,
  });

  await admin
    .from("entregas_premios")
    .update(
      enviado
        ? { status: "enviado", enviado_em: new Date().toISOString() }
        : { status: "falhou", observacoes: "Falha ao enviar o email via Resend" },
    )
    .eq("id", entregaId);

  return enviado ? {} : { error: "Falha ao enviar o email via Resend." };
}
