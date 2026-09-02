import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import { FREQUENCIA_MINIMA_PERCENTUAL } from "@/lib/presencas/schema";

export type AlunoFrequenciaBaixa = { nome: string; percentual: number };

export type TurmaFrequencia = {
  turmaId: string;
  turmaNome: string;
  percentual: number;
  alunosAbaixo: AlunoFrequenciaBaixa[];
};

// Núcleo de cálculo, sem efeito colateral — usado tanto por
// verificarFrequenciaTurmas() (que dispara os alertas de Telegram) quanto
// pelo resumo diário (que só precisa da contagem de turmas abaixo do
// mínimo, sem repetir o alerta individual de cada uma).
export async function calcularFrequenciaPorTurma(): Promise<TurmaFrequencia[]> {
  const admin = createAdminClient();

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const dataInicio = trintaDiasAtras.toISOString().slice(0, 10);

  const { data: turmasData } = await admin.from("turmas").select("id, nome").eq("status", "ativa");
  const turmas = turmasData ?? [];
  if (turmas.length === 0) return [];
  const turmaIds = turmas.map((turma) => turma.id);

  const { data: matriculasData } = await admin
    .from("matriculas")
    .select("id, turma_id, alunos(full_name)")
    .in("turma_id", turmaIds)
    .eq("status", "ativa");
  const matriculas = (matriculasData ?? []) as unknown as {
    id: string;
    turma_id: string;
    alunos: { full_name: string | null } | null;
  }[];
  if (matriculas.length === 0) return [];
  const matriculaIds = matriculas.map((matricula) => matricula.id);

  const { data: presencasData } = await admin
    .from("presencas")
    .select("matricula_id, status")
    .in("matricula_id", matriculaIds)
    .gte("data", dataInicio);
  const presencas = (presencasData ?? []) as { matricula_id: string; status: string }[];

  // % = (presente + reposicao) / total_registros * 100 — mesmo agrupamento
  // de calcularFrequencias em turma-detalhes.tsx e getRelatorioAcademico
  // (src/app/admin/relatorios/actions.ts).
  const contagemPorMatricula = new Map<string, { total: number; presentes: number }>();
  for (const presenca of presencas) {
    const atual = contagemPorMatricula.get(presenca.matricula_id) ?? { total: 0, presentes: 0 };
    atual.total += 1;
    if (presenca.status === "presente" || presenca.status === "reposicao") atual.presentes += 1;
    contagemPorMatricula.set(presenca.matricula_id, atual);
  }

  const resultado: TurmaFrequencia[] = [];

  for (const turma of turmas) {
    const percentuaisAlunos: AlunoFrequenciaBaixa[] = [];

    for (const matricula of matriculas) {
      if (matricula.turma_id !== turma.id) continue;
      const contagem = contagemPorMatricula.get(matricula.id);
      // Sem nenhum registro de presença nos últimos 30 dias (turma nova,
      // aluno recém-matriculado) — fica fora da média, pra não gerar um
      // falso alerta de 0% de frequência.
      if (!contagem || contagem.total === 0) continue;
      const percentual = Math.round((contagem.presentes / contagem.total) * 100);
      percentuaisAlunos.push({ nome: matricula.alunos?.full_name ?? "—", percentual });
    }

    if (percentuaisAlunos.length === 0) continue;

    const media = Math.round(
      percentuaisAlunos.reduce((soma, aluno) => soma + aluno.percentual, 0) / percentuaisAlunos.length,
    );

    resultado.push({
      turmaId: turma.id,
      turmaNome: turma.nome,
      percentual: media,
      alunosAbaixo: percentuaisAlunos.filter((aluno) => aluno.percentual < FREQUENCIA_MINIMA_PERCENTUAL),
    });
  }

  return resultado;
}

// Dispara turma.baixa_frequencia pra cada turma com média abaixo de 75% —
// chamado pelo cron de evasão (ver src/app/api/cron/calcular-evasao/route.ts).
// idempotencyKey inclui a data (não o timestamp): no máximo um alerta por
// turma por dia, mesmo se o cron rodar mais de uma vez.
export async function verificarFrequenciaTurmas(): Promise<{ turmasNotificadas: number }> {
  const turmas = await calcularFrequenciaPorTurma();
  const hoje = new Date().toISOString().slice(0, 10);
  let turmasNotificadas = 0;

  for (const turma of turmas) {
    if (turma.percentual >= FREQUENCIA_MINIMA_PERCENTUAL) continue;

    await dispararEvento(
      "turma.baixa_frequencia",
      {
        turma_nome: turma.turmaNome,
        turma_id: turma.turmaId,
        percentual: turma.percentual,
        alunos_abaixo: turma.alunosAbaixo,
      },
      `turma-baixa-frequencia-${turma.turmaId}-${hoje}`,
    );
    turmasNotificadas += 1;
  }

  return { turmasNotificadas };
}
