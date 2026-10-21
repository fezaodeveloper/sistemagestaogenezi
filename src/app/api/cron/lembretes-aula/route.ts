import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarMensagemLembreteAula } from "@/lib/mensagens/mensagens";

// Hora atual em Brasília (0-23) — comparada contra configuracoes.lembrete_aula_hora_envio.
function horaAtualBRT(): number {
  return Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }));
}

// "Quantas horas antes da aula" (configuracoes.lembrete_aula_horas_antes) traduzido pra uma data
// de calendário: o sistema só rastreia aula por DIA (calendario_aulas_turma + turma.horario_aula,
// um horário fixo diário recorrente), não por timestamp exato de cada sessão — então a
// granularidade real desta configuração é em dias, não em horas. horasAntes=24 (padrão) continua
// se comportando exatamente como o antigo amanhaISO() fixo.
//
// Data de HOJE calculada em BRT (não UTC) via Intl com locale en-CA (formata direto como
// YYYY-MM-DD) — importante porque este cron agora roda de hora em hora (ver vercel.json), ao
// contrário da versão antiga que só disparava 1x/dia às 11h UTC (fora da janela de virada de dia
// BRT, então UTC e BRT sempre bateriam). Resolvido com meio-dia UTC na soma de dias (mesmo
// truque usado em diaDaSemana, src/lib/whatsapp/eventos.ts) pra nunca escorregar de dia por fuso.
function dataAlvoISO(horasAntes: number): string {
  const hojeBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [ano, mes, dia] = hojeBRT.split("-").map(Number);
  const diasAntes = Math.max(0, Math.round(horasAntes / 24));
  const alvo = new Date(Date.UTC(ano, mes - 1, dia + diasAntes, 12));
  return alvo.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("configuracoes")
      .select("lembrete_aula_ativo, lembrete_aula_horas_antes, lembrete_aula_hora_envio")
      .eq("id", true)
      .maybeSingle();

    // config null (linha ausente) cai no comportamento antigo — nunca bloqueia por falta de
    // configuração explícita.
    if (config && !config.lembrete_aula_ativo) {
      return NextResponse.json({ ok: true, message: "lembretes de aula desativados em Configurações" });
    }

    const horaEnvioConfigurada = config?.lembrete_aula_hora_envio ?? 8;
    const horaAtual = horaAtualBRT();

    // O cron roda de hora em hora — só a rodada da hora configurada de fato dispara; as outras
    // 23 rodadas do dia só fazem esta checagem (uma query leve) e saem, sem tocar em
    // turmas/calendário/mensagens. Evita duplicidade sem depender de um agendamento fixo que só
    // um novo deploy poderia mudar.
    if (horaAtual !== horaEnvioConfigurada) {
      return NextResponse.json({
        ok: true,
        message: "fora do horário configurado",
        horaAtual,
        horaEnvioConfigurada,
      });
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
