import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarWhatsappAgendamentoLembrete2h } from "@/lib/whatsapp/eventos";
import { registrarHistoricoLead } from "@/lib/leads/leads";

// TAREFA agendamentos 2.4 (PARTE 5) — lembrete de ~2h antes do agendamento. Rodado a cada hora
// (ver vercel.json) — diferente do lembrete D-1 (cron /api/cron/lembrete-agendamentos, 1x/dia),
// que já existia e continua intacto (não repetido aqui, ver migration 20261030500000).
//
// Precisão: com o cron rodando de hora em hora, a janela "entre 1h30 e 2h30 de antecedência" tem
// até ~1h de folga pra cobrir qualquer agendamento que caia nela entre uma execução e a outra —
// na prática o lembrete sai entre ~1h30 e ~2h30 antes, nunca fora disso, mas não num minuto
// exato. lembrete_2h_enviado evita reenviar no próximo disparo da mesma hora.
export const maxDuration = 60;

type AgendamentoLembrete2h = { id: string; nome: string; whatsapp: string; data_agendada: string; horario: string; lead_id: string | null };

function horaMinuto(data: Date): string {
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

// "Agora" e a janela [+1h30, +2h30] em horário de Brasília — formatados como "HH:MM" (comparável
// lexicograficamente com a coluna `horario`, que é texto no mesmo formato).
function janelaBrasilia(): { hojeISO: string; amanhaISO: string; inicio: string; fim: string; vira: boolean } {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  const hojeISO = `${valor("year")}-${valor("month")}-${valor("day")}`;

  const agoraBrasilia = new Date(`${hojeISO}T${valor("hour")}:${valor("minute")}:00`);
  const inicioData = new Date(agoraBrasilia.getTime() + 90 * 60_000);
  const fimData = new Date(agoraBrasilia.getTime() + 150 * 60_000);

  const amanha = new Date(agoraBrasilia);
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = amanha.toISOString().slice(0, 10);

  // "vira" = a janela cruza a meia-noite (fimData já é do dia seguinte).
  const vira = fimData.getDate() !== agoraBrasilia.getDate();
  return { hojeISO, amanhaISO, inicio: horaMinuto(inicioData), fim: vira ? "23:59" : horaMinuto(fimData), vira };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const janela = janelaBrasilia();

    let query = admin
      .from("agendamentos")
      .select("id, nome, whatsapp, data_agendada, horario, lead_id")
      .eq("status", "confirmado")
      .eq("lembrete_2h_enviado", false)
      .eq("data_agendada", janela.hojeISO)
      .gte("horario", janela.inicio);
    if (!janela.vira) query = query.lte("horario", janela.fim);

    const { data: agendamentosHoje } = await query;

    // Janela cruzando a meia-noite: completa com a ponta do dia seguinte (00:00 até `fim`).
    let agendamentosAmanha: AgendamentoLembrete2h[] = [];
    if (janela.vira) {
      const { data } = await admin
        .from("agendamentos")
        .select("id, nome, whatsapp, data_agendada, horario, lead_id")
        .eq("status", "confirmado")
        .eq("lembrete_2h_enviado", false)
        .eq("data_agendada", janela.amanhaISO)
        .lte("horario", janela.fim);
      agendamentosAmanha = (data ?? []) as unknown as AgendamentoLembrete2h[];
    }

    const lista = [...((agendamentosHoje ?? []) as unknown as AgendamentoLembrete2h[]), ...agendamentosAmanha];

    for (const agendamento of lista) {
      // Sequencial — o delay entre chamadas (anti-banimento) é o próprio comportamento
      // desejado, não um custo a evitar. Nunca lança.
      await notificarWhatsappAgendamentoLembrete2h(agendamento.id);

      if (agendamento.lead_id) {
        await registrarHistoricoLead(admin, agendamento.lead_id, "agendamento", "Lembrete de agendamento (2h antes) enviado");
      }

      await admin.from("agendamentos").update({ lembrete_2h_enviado: true }).eq("id", agendamento.id);
    }

    return NextResponse.json({ quantidade: lista.length });
  } catch (error) {
    console.error("[CRON] Erro não tratado:", error);
    return NextResponse.json({ ok: false, erro: String(error) }, { status: 500 });
  }
}
