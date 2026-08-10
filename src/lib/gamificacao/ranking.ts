import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type RankingEntry = { alunoId: string; fullName: string | null; totalPontos: number };

// ranking_geral já filtra curso EAD pelo toggle atual (ver migration) e
// agrega por aluno entre todas as matrículas — só ordena aqui. Alunos sem
// nenhum ponto válido no momento (zero eventos, ou só eventos de curso EAD
// com o toggle desligado) simplesmente não aparecem — a view usa inner
// join, não é "aparecem com 0".
export async function getRankingGeral(supabase: SupabaseServerClient): Promise<RankingEntry[]> {
  const { data } = await supabase
    .from("ranking_geral")
    .select("aluno_id, full_name, total_pontos")
    .order("total_pontos", { ascending: false });

  return (data ?? []).map((row) => ({
    alunoId: row.aluno_id as string,
    fullName: row.full_name as string | null,
    totalPontos: row.total_pontos as number,
  }));
}

// Pra exibir "seus pontos" no dashboard do aluno — 0 se ele não tem
// nenhuma linha na view (nunca ganhou ponto válido ainda), sem precisar
// buscar o ranking inteiro só pra achar um número.
export async function getMeusPontos(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<number> {
  const { data } = await supabase
    .from("ranking_geral")
    .select("total_pontos")
    .eq("aluno_id", alunoId)
    .maybeSingle();

  return (data?.total_pontos as number | undefined) ?? 0;
}
