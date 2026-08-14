import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// calcular_streak_aluno é security definer (presencas não tem RLS de
// select pra aluno) — a própria function reimplementa a checagem de
// posse, então aqui só repassamos o id.
export async function getStreakAluno(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<number> {
  const { data } = await supabase.rpc("calcular_streak_aluno", { p_aluno_id: alunoId });
  return (data as number | null) ?? 0;
}
