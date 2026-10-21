import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagemLembreteAula } from "@/lib/mensagens/mensagens";

// "Quantas horas antes da aula" (configuracoes.lembrete_aula_horas_antes) traduzido pra uma data
// de calendário: o sistema só rastreia aula por DIA (calendario_aulas_turma + turma.horario_aula,
// um horário fixo diário recorrente), não por timestamp exato de cada sessão — então a
// granularidade real desta configuração é em dias, não em horas. horasAntes=24 (padrão) continua
// se comportando exatamente como o antigo amanhaISO() fixo.
//
// Data de HOJE calculada em BRT (não UTC) via Intl com locale en-CA (formata direto como
// YYYY-MM-DD). O cron roda 1x/dia às 11h UTC = 8h BRT (ver vercel.json — fora da janela de
// virada de dia BRT, então UTC e BRT sempre batem nesse horário fixo). Resolvido com meio-dia
// UTC na soma de dias (mesmo truque usado em diaDaSemana, src/lib/whatsapp/eventos.ts) pra nunca
// escorregar de dia por fuso.
function dataAlvoISO(horasAntes: number): string {
  const hojeBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [ano, mes, dia] = hojeBRT.split("-").map(Number);
  const diasAntes = Math.max(0, Math.round(horasAntes / 24));
  const alvo = new Date(Date.UTC(ano, mes - 1, dia + diasAntes, 12));
  return alvo.toISOString().slice(0, 10);
}

// Disparada 1x/dia pelo Vercel Cron (ver vercel.json), sempre às 11h UTC (08h BRT) — plano Hobby
// da Vercel não permite cron com frequência maior que 1x/dia, então configuracoes.
// lembrete_aula_hora_envio (painel "Horários de Notificações") NÃO é lido/comparado aqui: nada
// no código decide "a que hora rodar" além do schedule fixo em vercel.json, que só muda com um
// novo deploy. O campo continua salvo no banco e exposto no painel, documentado como reservado
// pra quando a escola estiver num plano Vercel Pro (permite cron mais granular, ex.: de hora em
// hora, e aí sim o handler poderia comparar a hora atual contra esse valor).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("configuracoes")
      .select("lembrete_aula_ativo, lembrete_aula_horas_antes")
      .eq("id", true)
      .maybeSingle();

    // config null (linha ausente) cai no comportamento antigo — nunca bloqueia por falta de
    // configuração explícita.
    if (config && !config.lembrete_aula_ativo) {
      return NextResponse.json({ ok: true, message: "lembretes de aula desativados em Configurações" });
    }

    const dataAlvo = dataAlvoISO(config?.lembrete_aula_horas_antes ?? 24);

    const { data: turmas } = await admin.from("turmas").select("id, horario_aula").eq("status", "ativa");

    let mensagensDisparadas = 0;

    for (const turma of turmas ?? []) {
      const { data: calendario } = await admin.rpc("calendario_aulas_turma", { p_turma_id: turma.id });
      const aulasAlvo = ((calendario ?? []) as { aula_id: string; data_liberacao: string }[]).filter(
        (c) => c.data_liberacao === dataAlvo,
      );
      if (aulasAlvo.length === 0) continue;

      const { data: matriculas } = await admin
        .from("matriculas")
        .select("id")
        .eq("turma_id", turma.id)
        .eq("status", "ativa");

      for (const aula of aulasAlvo) {
        for (const matricula of matriculas ?? []) {
          await enviarMensagemLembreteAula(matricula.id, aula.aula_id, dataAlvo, turma.horario_aula);
          mensagensDisparadas++;
        }
      }
    }

    return NextResponse.json({ ok: true, data: dataAlvo, mensagensDisparadas });
  } catch (error) {
    console.error("[CRON] Erro não tratado:", error);
    return NextResponse.json({ ok: false, erro: String(error) }, { status: 500 });
  }
}
