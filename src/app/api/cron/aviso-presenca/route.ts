import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { agoraEmBrasilia, diaDaSemana } from "@/lib/datas/util";

// Roda 1x por dia, às 22:00 UTC = 19:00 em Brasília (ver vercel.json) — o
// plano Hobby da Vercel só permite uma execução diária por cron. Por isso a
// lógica NÃO depende do horário da aula: pega TODAS as turmas presenciais/
// híbridas que têm aula hoje e ainda não tiveram presença marcada, e avisa no
// Telegram de uma vez.
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
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  // "Hoje" no horário de Brasília (a função serverless roda em UTC).
  const { hoje } = agoraEmBrasilia();
  const diaHoje = diaDaSemana(hoje);

  // Turmas ativas, dentro do período, com aula HOJE (cadência) e de curso
  // presencial ou híbrido (EAD não tem chamada).
  const { data: turmasData } = await admin
    .from("turmas")
    .select("id, nome, horario_aula, cursos!inner(tipo)")
    .eq("status", "ativa")
    .lte("data_inicio", hoje)
    .gte("data_fim", hoje)
    .contains("cadencia_dias_semana", [diaHoje])
    .in("cursos.tipo", ["presencial", "hibrido"]);

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
