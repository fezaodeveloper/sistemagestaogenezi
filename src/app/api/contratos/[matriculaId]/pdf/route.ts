import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Pública de propósito (REGRA da tarefa) — link enviado por WhatsApp (ver
// notificarWhatsappEnviarContrato em src/lib/whatsapp/eventos.ts), que precisa abrir sem login.
// O matricula_id funciona como um bearer token implícito aqui (mesmo risco já aceito pelas
// faturas do Asaas — parcela.asaas_invoice_url/asaas_bank_slip_url, também públicas por UUID,
// usadas em todo o financeiro deste projeto): quem tiver o link acessa o PDF, sem checar sessão.
// "recusado" fica de fora de propósito — contrato recusado não deve circular por este link.
export async function GET(_request: Request, { params }: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("contratos_assinados")
    .select("conteudo_pdf_base64, status")
    .eq("matricula_id", matriculaId)
    .in("status", ["pendente", "aceito"])
    .maybeSingle();

  if (!data?.conteudo_pdf_base64) {
    return new Response("Contrato não encontrado.", { status: 404 });
  }

  const buffer = Buffer.from(data.conteudo_pdf_base64, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=contrato.pdf",
    },
  });
}
