import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SaldoCreditos = {
  pontosTotais: number;
  creditosGanhos: number;
  creditosGastos: number;
  creditosDisponiveis: number;
};

// creditos_saldo é security_invoker — cada aluno só enxerga a própria
// linha via RLS de profiles/pontos_eventos/resgates (diferente de
// ranking_geral, que é deliberadamente pública). maybeSingle: um aluno
// sem nenhum ponto ainda não tem linha nenhuma (join com pontos_eventos
// é left join, mas a base é profiles — só não aparece se a RLS de
// profiles não devolver a linha, o que não deveria acontecer pro próprio
// aluno).
export async function getSaldoCreditos(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<SaldoCreditos> {
  const { data } = await supabase
    .from("creditos_saldo")
    .select("pontos_totais, creditos_ganhos, creditos_gastos, creditos_disponiveis")
    .eq("aluno_id", alunoId)
    .maybeSingle();

  return {
    pontosTotais: (data?.pontos_totais as number | undefined) ?? 0,
    creditosGanhos: (data?.creditos_ganhos as number | undefined) ?? 0,
    creditosGastos: (data?.creditos_gastos as number | undefined) ?? 0,
    creditosDisponiveis: (data?.creditos_disponiveis as number | undefined) ?? 0,
  };
}
