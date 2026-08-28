import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { enviarAlertaTelegram } from "@/lib/telegram/client";

// Endpoint de teste de integração — só admin autenticado, usado pra
// confirmar que TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID estão configurados
// corretamente no Vercel sem precisar esperar um evento real acontecer.
export async function GET() {
  await requireRole("admin");

  const enviado = await enviarAlertaTelegram(
    "Teste de Integração",
    ["✅ Se você está vendo esta mensagem, o bot está configurado corretamente."],
    "🧪",
  );

  if (!enviado) {
    return NextResponse.json(
      { ok: false, mensagem: "Não foi possível enviar a mensagem de teste. Confira TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, mensagem: "Mensagem de teste enviada ao grupo do Telegram." });
}
