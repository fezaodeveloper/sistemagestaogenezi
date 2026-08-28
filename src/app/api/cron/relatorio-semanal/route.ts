import "server-only";

import { NextResponse } from "next/server";
import { dispararEvento } from "@/lib/automacoes/motor";

// Disparado sexta-feira às 21:00 UTC (18:00 BRT) pelo Vercel Cron (ver
// vercel.json). Confere o dia da semana em BRT (UTC-3) antes de rodar —
// mesmo que o schedule já só dispare sexta, essa dupla checagem protege
// contra um trigger manual/replay fora do dia certo.
function ehSextaFeiraBRT(): boolean {
  const agoraBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return agoraBRT.getUTCDay() === 5;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!ehSextaFeiraBRT()) {
    return NextResponse.json({ ok: true, ignorado: "não é sexta-feira" });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  await dispararEvento("relatorio.semanal", {}, `relatorio-semanal-${hoje}`);

  return NextResponse.json({ ok: true });
}
