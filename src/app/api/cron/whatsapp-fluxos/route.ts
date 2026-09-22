import "server-only";

import { NextResponse } from "next/server";
import { retomarExecucoesPendentes } from "@/lib/whatsapp/fluxos";

// Retoma execuções de fluxo paradas num nó "aguardar" cujo prazo já venceu (ver
// src/lib/whatsapp/fluxos.ts). Roda 1x/dia (plano Hobby da Vercel só permite crons diários —
// mesma restrição já aceita por sms-recuperacao) — por isso um "aguardar" configurado em
// minutos/horas na prática só é retomado na próxima execução deste cron, não com precisão de
// minuto/hora. Documentado também no editor de fluxos.
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultado = await retomarExecucoesPendentes();
  return NextResponse.json(resultado);
}
