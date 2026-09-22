import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { dataComDiaSemana } from "@/lib/datas/util";
import { notificarSmsAgendamentoLembrete } from "@/lib/integrax/notificacoes";
import { notificarWhatsappAgendamentoLembrete } from "@/lib/whatsapp/eventos";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

type AgendamentoLembrete = {
  id: string;
  nome: string;
  whatsapp: string;
  horario: string;
  data_agendada: string;
  campos_extras: Record<string, string> | null;
  agendamento_paginas: { titulo: string } | null;
};

// "Interesse" não é coluna: vem dos campos extras que a página de agendamento
// configura (ex.: um select "Interesse" com os cursos). Usa o campo cujo nome
// contém "interesse"; se não houver, o primeiro campo preenchido; senão "—".
function extrairInteresse(campos: Record<string, string> | null): string {
  if (!campos) return "—";
  const entradas = Object.entries(campos).filter(([, valor]) => typeof valor === "string" && valor.trim() !== "");
  const interesse = entradas.find(([nome]) => nome.toLowerCase().includes("interesse")) ?? entradas[0];
  return interesse ? interesse[1] : "—";
}

// Disparado 1x/dia às 18:00 UTC (ver vercel.json) — roadmap item 2. Lembrete real por WhatsApp
// (GênZap) desde esta tarefa — antes era só um stub (console.log). Segue marcando
// lembrete_enviado, pra não reenviar em execuções seguintes, mesmo se o WhatsApp não estiver
// configurado (o "stub silencioso" de enviarWhatsApp já cobre esse caso).
export const maxDuration = 60;

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
    .select("id, nome, whatsapp, horario, data_agendada, campos_extras, agendamento_paginas(titulo)")
    .eq("data_agendada", amanhaISO)
    .eq("status", "confirmado")
    .eq("lembrete_enviado", false);

  const lista = (agendamentos ?? []) as unknown as AgendamentoLembrete[];

  for (const agendamento of lista) {
    // WhatsApp (GênZap/Evolution API). Sequencial — o delay entre chamadas (anti-banimento) é o
    // próprio comportamento desejado aqui, não um custo a evitar. Nunca lança.
    await notificarWhatsappAgendamentoLembrete(agendamento.id);

    // Lembrete no Telegram (pro admin, além do WhatsApp ao cliente acima). Best-effort:
    // sendTelegram nunca lança.
    await sendTelegram(
      [
        "📅 <b>Lembrete de agendamento amanhã:</b>",
        `👤 Nome: ${escapeHtml(agendamento.nome)}`,
        `📞 WhatsApp: ${escapeHtml(agendamento.whatsapp)}`,
        `📚 Interesse: ${escapeHtml(extrairInteresse(agendamento.campos_extras))}`,
        `🗓️ Dia: ${escapeHtml(dataComDiaSemana(agendamento.data_agendada))}`,
        `⏰ Horário: ${escapeHtml(agendamento.horario)}`,
        `📋 Página: ${escapeHtml(agendamento.agendamento_paginas?.titulo ?? "—")}`,
      ].join("\n"),
    );

    // SMS do lembrete (template "agendamento_lembrete" da IntegraX). Roda depois da resposta,
    // nunca lança; com a integração desligada só registra no console (stub).
    notificarSmsAgendamentoLembrete(agendamento.id);

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
