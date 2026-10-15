import "server-only";

import { gerarComprovantePdf } from "@/lib/comprovante/pdf";

// Pública de propósito (REGRA da tarefa) — link enviado por WhatsApp (ver
// notificarWhatsappEnviarComprovante em src/lib/whatsapp/eventos.ts), precisa abrir sem login.
// Mesmo modelo de risco já aceito pela rota irmã de contrato
// (src/app/api/contratos/[matriculaId]/pdf/route.ts) e pelas faturas do Asaas: matricula_id
// funciona como bearer token implícito.
export async function GET(_request: Request, { params }: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await params;

  try {
    const buffer = await gerarComprovantePdf(matriculaId);
    // new Uint8Array(buffer) (não o Buffer direto): o generic de retorno de renderToBuffer
    // (Buffer<ArrayBufferLike>) não casa com o BodyInit que Response aceita — essa cópia
    // normaliza pro Uint8Array plano, que sempre satisfaz o tipo.
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=comprovante.pdf",
      },
    });
  } catch {
    return new Response("Comprovante não encontrado.", { status: 404 });
  }
}
