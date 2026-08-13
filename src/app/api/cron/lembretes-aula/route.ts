import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagemLembreteAula } from "@/lib/mensagens/mensagens";

// Disparada 1x/dia pelo Vercel Cron (ver vercel.json) — agendada pra
// 11:00 UTC (08:00 BRT), fora da janela de virada de dia em BRT, então o
// "amanhã" calculado em UTC abaixo sempre bate com o "amanhã" em BRT.
function amanhaISO(): string {
  const hoje = new Date();
  const amanha = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 1));
  return amanha.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const amanha = amanhaISO();

  const { data: turmas } = await admin.from("turmas").select("id, horario_aula").eq("status", "ativa");

  let mensagensDisparadas = 0;

  for (const turma of turmas ?? []) {
    const { data: calendario } = await admin.rpc("calendario_aulas_turma", { p_turma_id: turma.id });
    const aulasAmanha = ((calendario ?? []) as { aula_id: string; data_liberacao: string }[]).filter(
      (c) => c.data_liberacao === amanha,
    );
    if (aulasAmanha.length === 0) continue;

    const { data: matriculas } = await admin
      .from("matriculas")
      .select("id")
      .eq("turma_id", turma.id)
      .eq("status", "ativa");

    for (const aula of aulasAmanha) {
      for (const matricula of matriculas ?? []) {
        await enviarMensagemLembreteAula(matricula.id, aula.aula_id, amanha, turma.horario_aula);
        mensagensDisparadas++;
      }
    }
  }

  return NextResponse.json({ ok: true, data: amanha, mensagensDisparadas });
}
