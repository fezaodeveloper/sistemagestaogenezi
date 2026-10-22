import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { agoraEmBrasilia, diaDaSemana } from "@/lib/datas/util";

// Roda 1x por dia, às 22:00 UTC = 19:00 em Brasília (ver vercel.json) — o plano Hobby da Vercel
// só permite uma execução diária por cron, num horário fixo que só muda com um novo deploy. Por
// isso o controle de "horário" não é "a que hora o cron roda" (fixo), e sim um filtro configurável
// sobre QUAIS turmas entram: configuracoes.telegram_aviso_presenca_hora_limite (painel
// Configurações > Notificações > "Aviso de presença (Telegram)", ver migration 20261022160000) —
// só turmas com horario_aula <= esse limite disparam o aviso; turmas sem horario_aula cadastrado
// entram mesmo assim (não há como filtrar o que não existe). configuracoes.
// telegram_aviso_presenca_ativo desliga o aviso por completo quando false.
//
// "Ainda não tiveram presença marcada" = nenhuma linha em `presencas` com a
// data de hoje para as matrículas ativas da turma. Quem garante UM aviso só
// por turma por dia, mesmo se o cron rodar duas vezes, é a idempotency_key do
// motor de automações (aviso-presenca-{turma}-{data}).
type TurmaComAulaHoje = {
  id: string;
  nome: string;
  // Opcional na turma; entra na mensagem quando existe ("HH:MM:SS").
  horario_aula: string | null;
  professor: string | null;
  telegram_chat_id: string | null;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // config null (linha ausente) cai no comportamento antigo — nunca bloqueia por falta de
  // configuração explícita, mesmo padrão já usado no cron lembretes-aula.
  const { data: config } = await admin
    .from("configuracoes")
    .select("telegram_aviso_presenca_ativo, telegram_aviso_presenca_hora_limite")
    .eq("id", true)
    .maybeSingle();

  if (config && !config.telegram_aviso_presenca_ativo) {
    return NextResponse.json({ ok: true, message: "aviso de presença desativado em Configurações" });
  }
  const horaLimite = config?.telegram_aviso_presenca_hora_limite ?? null;

  // "Hoje" no horário de Brasília (a função serverless roda em UTC).
  const { hoje } = agoraEmBrasilia();
  const diaHoje = diaDaSemana(hoje);

  // Turmas ativas, dentro do período, com aula HOJE (cadência) e de curso
  // presencial ou híbrido (EAD não tem chamada).
  let query = admin
    .from("turmas")
    .select("id, nome, horario_aula, professor, telegram_chat_id, cursos!inner(tipo)")
    .eq("status", "ativa")
    .lte("data_inicio", hoje)
    .gte("data_fim", hoje)
    .contains("cadencia_dias_semana", [diaHoje])
    .in("cursos.tipo", ["presencial", "hibrido"]);

  // horario_aula null entra mesmo assim (sem dado pra filtrar) — só exclui quem tem horário
  // cadastrado E está depois do limite configurado.
  if (horaLimite) {
    query = query.or(`horario_aula.is.null,horario_aula.lte.${horaLimite}`);
  }

  const { data: turmasData } = await query;

  const turmas = (turmasData ?? []) as unknown as TurmaComAulaHoje[];

  let avisadas = 0;
  let presencaJaMarcada = 0;
  let semAlunos = 0;

  for (const turma of turmas) {
    const { data: matriculas } = await admin
      .from("matriculas")
      .select("id")
      .eq("turma_id", turma.id)
      .eq("status", "ativa");
    const idsMatriculas = (matriculas ?? []).map((m) => m.id as string);
    if (idsMatriculas.length === 0) {
      semAlunos += 1;
      continue;
    }

    // Presença de hoje já lançada por alguém? Então não há o que avisar.
    const { count: presencasHoje } = await admin
      .from("presencas")
      .select("id", { count: "exact", head: true })
      .eq("data", hoje)
      .in("matricula_id", idsMatriculas);
    if (presencasHoje && presencasHoje > 0) {
      presencaJaMarcada += 1;
      continue;
    }

    await dispararEvento(
      "aviso.presenca",
      {
        turma_id: turma.id,
        turma_nome: turma.nome,
        horario_inicio: turma.horario_aula ? turma.horario_aula.slice(0, 5) : null,
        alunos_ativos: idsMatriculas.length,
        professor_nome: turma.professor,
        telegram_chat_id: turma.telegram_chat_id,
      },
      `aviso-presenca-${turma.id}-${hoje}`,
    );
    avisadas += 1;
  }

  return NextResponse.json({
    hoje,
    turmasComAulaHoje: turmas.length,
    avisadas,
    presencaJaMarcada,
    semAlunos,
  });
}
