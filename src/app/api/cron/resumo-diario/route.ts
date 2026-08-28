import "server-only";

import { NextResponse } from "next/server";
import { dispararEvento } from "@/lib/automacoes/motor";

// Disparado 1x/dia às 10:30 UTC (07:30 BRT) pelo Vercel Cron (ver
// vercel.json) — mesmo padrão de autenticação de src/app/api/cron/lembretes-aula/route.ts.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  await dispararEvento("resumo.diario", {}, `resumo-diario-${hoje}`);

  return NextResponse.json({ ok: true });
}
