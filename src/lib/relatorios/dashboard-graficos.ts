import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { MATRICULA_STATUS_LABELS } from "@/lib/matriculas/schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type DashboardGraficosDados = {
  receitaMensal: { mes: string; valor: number }[];
  novasMatriculasPorMes: { mes: string; total: number }[];
  statusMatriculas: { status: string; label: string; total: number }[];
};

function ultimosSeisMeses() {
  const hoje = new Date();
  return Array.from({ length: 6 }, (_, indice) => {
    const offset = 5 - indice;
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - offset, 1);
    return {
      chave: `${data.getFullYear()}-${data.getMonth()}`,
      label: MESES_PT[data.getMonth()],
      inicioISO: data.toISOString().slice(0, 10),
    };
  });
}

// Chamado em paralelo com os KPIs do dashboard (REGRA da tarefa) — recebe o
// client já criado pelo caller em vez de criar o seu próprio, mesmo padrão
// de getVagasDaEmpresa/getCandidatosDisponiveis (funções de lib que reaproveitam
// o client do chamador).
export async function getDadosGraficosDashboard(supabase: SupabaseServerClient): Promise<DashboardGraficosDados> {
  const meses = ultimosSeisMeses();
  const inicioPeriodo = meses[0].inicioISO;

  const [{ data: parcelasPagas }, { data: matriculasRecentes }, { data: todasMatriculas }] = await Promise.all([
    supabase.from("parcelas").select("valor, data_pagamento").eq("status", "pago").gte("data_pagamento", inicioPeriodo),
    supabase
      .from("matriculas")
      .select("aluno_id, data_matricula")
      .eq("status", "ativa")
      .gte("data_matricula", inicioPeriodo),
    supabase.from("matriculas").select("status"),
  ]);

  const receitaPorMes = new Map(meses.map((m) => [m.chave, 0]));
  for (const parcela of parcelasPagas ?? []) {
    const data = new Date(parcela.data_pagamento as string);
    const chave = `${data.getFullYear()}-${data.getMonth()}`;
    if (receitaPorMes.has(chave)) {
      receitaPorMes.set(chave, (receitaPorMes.get(chave) ?? 0) + Number(parcela.valor));
    }
  }

  const alunosPorMes = new Map<string, Set<string>>(meses.map((m) => [m.chave, new Set<string>()]));
  for (const matricula of matriculasRecentes ?? []) {
    const data = new Date(matricula.data_matricula as string);
    const chave = `${data.getFullYear()}-${data.getMonth()}`;
    alunosPorMes.get(chave)?.add(matricula.aluno_id as string);
  }

  const statusCount = new Map<string, number>();
  for (const matricula of todasMatriculas ?? []) {
    const status = matricula.status as string;
    statusCount.set(status, (statusCount.get(status) ?? 0) + 1);
  }

  // "trancada" não existe no enum real (matricula_status é ativa / inativa /
  // concluida / cancelada / transferida, ver src/lib/matriculas/schema.ts) —
  // usados os status reais; "transferida" (alias legado de "inativa" nesse
  // mesmo arquivo) entra somado em "inativa" pra não duplicar uma barra.
  const statusMatriculas = [
    { status: "ativa", label: MATRICULA_STATUS_LABELS.ativa, total: statusCount.get("ativa") ?? 0 },
    { status: "concluida", label: MATRICULA_STATUS_LABELS.concluida, total: statusCount.get("concluida") ?? 0 },
    {
      status: "inativa",
      label: MATRICULA_STATUS_LABELS.inativa,
      total: (statusCount.get("inativa") ?? 0) + (statusCount.get("transferida") ?? 0),
    },
    { status: "cancelada", label: MATRICULA_STATUS_LABELS.cancelada, total: statusCount.get("cancelada") ?? 0 },
  ];

  return {
    receitaMensal: meses.map((m) => ({ mes: m.label, valor: receitaPorMes.get(m.chave) ?? 0 })),
    novasMatriculasPorMes: meses.map((m) => ({ mes: m.label, total: alunosPorMes.get(m.chave)?.size ?? 0 })),
    statusMatriculas,
  };
}
