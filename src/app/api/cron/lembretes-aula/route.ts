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
function hojeISOBRT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function somarDias(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  // meio-dia UTC: mesmo truque de diaDaSemana (src/lib/whatsapp/eventos.ts) pra nunca escorregar
  // de dia por fuso.
  return new Date(Date.UTC(ano, mes - 1, dia + dias, 12)).toISOString().slice(0, 10);
}

function dataAlvoISO(horasAntes: number): string {
  const diasAntes = Math.max(0, Math.round(horasAntes / 24));
  return somarDias(hojeISOBRT(), diasAntes);
}

const DIAS_POR_RECORRENCIA: Record<string, number> = { diario: 1, semanal: 7, quinzenal: 15, mensal: 30 };

// "Painel de Notificações" (/admin/configuracoes, aba Notificações, seção Regras) — regras com
// tipo='lembrete_aula' ativas e já vencidas (proxima_execucao <= hoje) avançam pra hoje + N dias,
// conforme a recorrência escolhida. Base é SEMPRE hoje (não a proxima_execucao antiga): se o cron
// não rodar num dia, a regra não acumula atraso — ela só volta a disparar na própria base, em vez
// de ficar "devendo" execuções passadas. Best-effort: nunca deve derrubar a resposta do cron, já
// que os lembretes de aula em si (o que realmente importa) já foram disparados antes desta
// chamada.
async function avancarRegrasLembreteAula(admin: ReturnType<typeof createAdminClient>, hojeISO: string): Promise<void> {
  const { data: regras } = await admin
    .from("regras_notificacao")
    .select("id, recorrencia")
    .eq("tipo", "lembrete_aula")
    .eq("ativo", true)
    .lte("proxima_execucao", hojeISO);

  for (const regra of regras ?? []) {
    const dias = DIAS_POR_RECORRENCIA[regra.recorrencia] ?? 1;
    await admin
      .from("regras_notificacao")
      .update({ ultima_execucao: new Date().toISOString(), proxima_execucao: somarDias(hojeISO, dias) })
      .eq("id", regra.id);
  }
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

    try {
      await avancarRegrasLembreteAula(admin, hojeISOBRT());
    } catch (erro) {
      console.error("[CRON] falha ao avançar regras_notificacao (lembretes já foram enviados normalmente):", erro);
    }

    return NextResponse.json({ ok: true, data: dataAlvo, mensagensDisparadas });
  } catch (error) {
    console.error("[CRON] Erro não tratado:", error);
    return NextResponse.json({ ok: false, erro: String(error) }, { status: 500 });
  }
}
