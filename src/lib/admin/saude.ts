import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Mesmo limiar de nota mínima usado em getRelatorioAcademico
// (src/app/admin/relatorios/actions.ts) — não exportado de lá porque é um
// arquivo "use server" (só pode exportar async functions), então o valor é
// duplicado aqui. Regra de negócio fixa, não configurável.
const NOTA_MINIMA_APROVACAO = 60;

// Janela de presenças considerada no componente de frequência — últimos 90
// dias, pra refletir o momento atual da escola em vez do histórico inteiro.
const JANELA_FREQUENCIA_DIAS = 90;

export type SaudeEscola = {
  pontuacao: number;
  ocupacao: number;
  pagamentosEmDia: number;
  frequencia: number;
  notaAcima: number;
};

// Pontuação de 0-100 combinando 4 indicadores (pesos: ocupação 30%,
// pagamentos em dia 30%, frequência 20%, nota acima do mínimo 20%),
// exibida em src/components/admin/saude-escola.tsx.
export async function calcularSaudeEscola(supabase: SupabaseServerClient): Promise<SaudeEscola> {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - JANELA_FREQUENCIA_DIAS);
  const dataLimiteStr = dataLimite.toISOString().slice(0, 10);

  const [
    { data: turmasData },
    { data: matriculasAtivasData },
    { data: parcelasAtrasadasData },
    { data: presencasData },
    { data: certificadosData },
  ] = await Promise.all([
    supabase.from("turmas").select("capacidade_maxima, vagas_ocupadas").eq("status", "ativa"),
    supabase.from("matriculas").select("aluno_id").eq("status", "ativa"),
    supabase.from("parcelas").select("aluno_id").eq("status", "atrasado"),
    supabase
      .from("presencas")
      .select("status, matriculas!inner(status)")
      .eq("matriculas.status", "ativa")
      .gte("data", dataLimiteStr),
    supabase.from("certificados").select("aproveitamento_percentual").not("aproveitamento_percentual", "is", null),
  ]);

  // Ocupação: média de vagas_ocupadas/capacidade_maxima entre turmas ativas.
  const turmas = (turmasData ?? []) as { capacidade_maxima: number; vagas_ocupadas: number }[];
  const ocupacao =
    turmas.length > 0
      ? Math.round(
          (turmas.reduce((soma, turma) => soma + (turma.capacidade_maxima > 0 ? turma.vagas_ocupadas / turma.capacidade_maxima : 0), 0) /
            turmas.length) *
            100,
        )
      : 100;

  // Pagamentos em dia: % de alunos com matrícula ativa que não têm nenhuma
  // parcela em atraso.
  const alunosAtivos = new Set(((matriculasAtivasData ?? []) as { aluno_id: string }[]).map((m) => m.aluno_id));
  const alunosComAtraso = new Set(((parcelasAtrasadasData ?? []) as { aluno_id: string }[]).map((p) => p.aluno_id));
  let alunosEmDia = 0;
  for (const alunoId of alunosAtivos) {
    if (!alunosComAtraso.has(alunoId)) alunosEmDia += 1;
  }
  const pagamentosEmDia = alunosAtivos.size > 0 ? Math.round((alunosEmDia / alunosAtivos.size) * 100) : 100;

  // Frequência: % de registros presente/reposição sobre o total, nos
  // últimos 90 dias, só de matrículas ativas.
  const presencas = (presencasData ?? []) as { status: string }[];
  const presentes = presencas.filter((p) => p.status === "presente" || p.status === "reposicao").length;
  const frequencia = presencas.length > 0 ? Math.round((presentes / presencas.length) * 100) : 100;

  // Nota acima do mínimo: % de certificados avaliados com aproveitamento >= 60.
  const certificados = (certificadosData ?? []) as { aproveitamento_percentual: number | null }[];
  const acimaDoMinimo = certificados.filter((c) => (c.aproveitamento_percentual ?? 0) >= NOTA_MINIMA_APROVACAO).length;
  const notaAcima = certificados.length > 0 ? Math.round((acimaDoMinimo / certificados.length) * 100) : 100;

  const pontuacao = Math.round(ocupacao * 0.3 + pagamentosEmDia * 0.3 + frequencia * 0.2 + notaAcima * 0.2);

  return { pontuacao, ocupacao, pagamentosEmDia, frequencia, notaAcima };
}
