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

// Streak só se aplica a curso presencial/híbrido — usado pra decidir se
// o card de streak aparece na tela do aluno.
export async function alunoTemCursoPresencialOuHibrido(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("matriculas")
    .select("turmas(cursos(tipo))")
    .eq("aluno_id", alunoId);

  const rows = (data ?? []) as unknown as { turmas: { cursos: { tipo: string } | null } | null }[];
  return rows.some((row) => row.turmas?.cursos && row.turmas.cursos.tipo !== "ead");
}
