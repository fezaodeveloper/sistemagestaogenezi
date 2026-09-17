import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";

// Disparado 1x/dia às 18:00 UTC (ver vercel.json) — roadmap item 2. Sem
// Evolution API ainda: o lembrete D-1 é só um stub (console.log) que marca
// lembrete_enviado, pra não reenviar em execuções seguintes.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = amanha.toISOString().slice(0, 10);

  const { data: agendamentos } = await admin
    .from("agendamentos")
    .select("id, nome, horario")
    .eq("data_agendada", amanhaISO)
    .eq("status", "confirmado")
    .eq("lembrete_enviado", false);

  const lista = (agendamentos ?? []) as { id: string; nome: string; horario: string }[];

  for (const agendamento of lista) {
    // Stub — Evolution API virá depois.
    console.log(
      `[lembrete-agendamentos] Enviaria WhatsApp para ${agendamento.nome}: lembrete de amanhã ${agendamento.horario}`,
    );

    await admin.from("agendamentos").update({ lembrete_enviado: true }).eq("id", agendamento.id);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  await dispararEvento(
    "lembretes.agendamentos.resumo",
    { quantidade: lista.length },
    `lembretes-agendamentos-${hoje}`,
  );

  return NextResponse.json({ quantidade: lista.length });
}
