"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FREQUENCIA_MINIMA_PERCENTUAL, PRESENCA_STATUSES } from "@/lib/presencas/schema";
import { GASTO_CATEGORIAS } from "@/lib/financeiro/schema";

// Nota mínima de aprovação deste relatório — independente do
// certificado_nota_minima_percentual configurável em /admin/configuracoes
// (esse é o mínimo pra EMITIR o certificado; aqui é só um resumo de
// desempenho por turma, valor fixo por decisão de produto).
const NOTA_MINIMA_APROVACAO = 60;

export type AlunoRelatorioAcademico = {
  matriculaId: string;
  nome: string;
  email: string;
  totalAulas: number;
  presencas: number;
  faltas: number;
  percentualFrequencia: number;
  notaFinal: number | null;
  status: "Aprovado" | "Reprovado" | "Em andamento";
};

export type RelatorioAcademico = {
  turma: { nome: string; curso: string };
  alunos: AlunoRelatorioAcademico[];
};

export type RelatorioAcademicoResult = { success: true; data: RelatorioAcademico } | { error: string };

export async function getRelatorioAcademico(
  turmaId: string,
  dataInicio: string,
  dataFim: string,
): Promise<RelatorioAcademicoResult> {
  await requireRole("admin");

  const supabase = await createClient();

  const { data: turmaData } = await supabase
    .from("turmas")
    .select("nome, cursos(nome)")
    .eq("id", turmaId)
    .single();

  if (!turmaData) {
    return { error: "Turma não encontrada." };
  }
  const turma = turmaData as unknown as { nome: string; cursos: { nome: string } | null };

  const { data: matriculasData } = await supabase
    .from("matriculas")
    .select("id, alunos(full_name, email)")
    .eq("turma_id", turmaId);

  const matriculas = (matriculasData ?? []) as unknown as {
    id: string;
    alunos: { full_name: string | null; email: string } | null;
  }[];

  if (matriculas.length === 0) {
    return {
      success: true,
      data: { turma: { nome: turma.nome, curso: turma.cursos?.nome ?? "—" }, alunos: [] },
    };
  }

  const matriculaIds = matriculas.map((matricula) => matricula.id);

  const [{ data: presencasData }, { data: certificadosData }] = await Promise.all([
    supabase
      .from("presencas")
      .select("matricula_id, status")
      .in("matricula_id", matriculaIds)
      .gte("data", dataInicio)
      .lte("data", dataFim),
    supabase.from("certificados").select("matricula_id, aproveitamento_percentual").in("matricula_id", matriculaIds),
  ]);

  // totalAulas conta qualquer registro de presença no período (presente,
  // falta, justificada ou reposição); presencas = presente+reposicao,
  // faltas = falta+justificada — mesmo agrupamento de calcularFrequencias
  // em turma-detalhes.tsx.
  const contagemPorMatricula = new Map<string, { total: number; presencas: number; faltas: number }>();
  for (const presenca of (presencasData ?? []) as { matricula_id: string; status: (typeof PRESENCA_STATUSES)[number] }[]) {
    const atual = contagemPorMatricula.get(presenca.matricula_id) ?? { total: 0, presencas: 0, faltas: 0 };
    atual.total += 1;
    if (presenca.status === "presente" || presenca.status === "reposicao") atual.presencas += 1;
    else atual.faltas += 1;
    contagemPorMatricula.set(presenca.matricula_id, atual);
  }

  const notaPorMatricula = new Map<string, number | null>();
  for (const certificado of (certificadosData ?? []) as {
    matricula_id: string;
    aproveitamento_percentual: number | null;
  }[]) {
    notaPorMatricula.set(certificado.matricula_id, certificado.aproveitamento_percentual);
  }

  const alunos: AlunoRelatorioAcademico[] = matriculas.map((matricula) => {
    const contagem = contagemPorMatricula.get(matricula.id) ?? { total: 0, presencas: 0, faltas: 0 };
    const percentualFrequencia = contagem.total > 0 ? Math.round((contagem.presencas / contagem.total) * 100) : 0;
    const notaFinal = notaPorMatricula.get(matricula.id) ?? null;

    // "Sem nota ainda" (certificado não avaliado) sempre conta como "Em
    // andamento" — o curso ainda não terminou pra esse aluno, então a
    // frequência parcial até aqui não decide aprovação/reprovação.
    let status: AlunoRelatorioAcademico["status"];
    if (notaFinal === null) {
      status = "Em andamento";
    } else if (percentualFrequencia >= FREQUENCIA_MINIMA_PERCENTUAL && notaFinal >= NOTA_MINIMA_APROVACAO) {
      status = "Aprovado";
    } else {
      status = "Reprovado";
    }

    return {
      matriculaId: matricula.id,
      nome: matricula.alunos?.full_name ?? "—",
      email: matricula.alunos?.email ?? "—",
      totalAulas: contagem.total,
      presencas: contagem.presencas,
      faltas: contagem.faltas,
      percentualFrequencia,
      notaFinal,
      status,
    };
  });

  return {
    success: true,
    data: { turma: { nome: turma.nome, curso: turma.cursos?.nome ?? "—" }, alunos },
  };
}

export type RelatorioFinanceiro = {
  receitas: { parcelas: number; avulsos: number; total: number };
  inadimplencia: { valorAtrasado: number; quantidadeAtrasadas: number; taxaInadimplencia: number };
  gastos: { total: number; porCategoria: Record<string, number> };
  saldo: number;
};

export type RelatorioFinanceiroResult = { success: true; data: RelatorioFinanceiro } | { error: string };

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

export async function getRelatorioFinanceiro(ano: number, mes: number): Promise<RelatorioFinanceiroResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  const [
    { data: parcelasPagasData },
    { data: avulsosData },
    { data: gastosData },
    { data: atrasadasData },
    { data: todasParcelasData },
  ] = await Promise.all([
    supabase.from("parcelas").select("valor").eq("status", "pago").gte("data_pagamento", inicio).lte("data_pagamento", fim),
    supabase.from("pagamentos_avulsos").select("valor").gte("data_pagamento", inicio).lte("data_pagamento", fim),
    supabase.from("gastos").select("categoria, valor").gte("data_gasto", inicio).lte("data_gasto", fim),
    supabase.from("parcelas").select("valor").eq("status", "atrasado"),
    // "Total emitido" pra taxa de inadimplência = soma de todas as parcelas
    // já geradas no sistema (qualquer status), não só as do mês — reflete o
    // volume total de cobrança já lançado, ponto de referência pro quanto
    // disso está em atraso.
    supabase.from("parcelas").select("valor"),
  ]);

  const receitaParcelas = somarValores(parcelasPagasData);
  const receitaAvulsos = somarValores(avulsosData);

  const porCategoria: Record<string, number> = Object.fromEntries(
    GASTO_CATEGORIAS.map((categoria) => [categoria, 0]),
  );
  for (const gasto of (gastosData ?? []) as { categoria: string; valor: number }[]) {
    porCategoria[gasto.categoria] = (porCategoria[gasto.categoria] ?? 0) + Number(gasto.valor);
  }
  const totalGastos = somarValores(gastosData as { valor: number }[] | null);

  const valorAtrasado = somarValores(atrasadasData);
  const totalEmitido = somarValores(todasParcelasData);
  const taxaInadimplencia = totalEmitido > 0 ? Math.round((valorAtrasado / totalEmitido) * 1000) / 10 : 0;

  const totalReceitas = receitaParcelas + receitaAvulsos;

  return {
    success: true,
    data: {
      receitas: { parcelas: receitaParcelas, avulsos: receitaAvulsos, total: totalReceitas },
      inadimplencia: {
        valorAtrasado,
        quantidadeAtrasadas: (atrasadasData ?? []).length,
        taxaInadimplencia,
      },
      gastos: { total: totalGastos, porCategoria },
      saldo: totalReceitas - totalGastos,
    },
  };
}
