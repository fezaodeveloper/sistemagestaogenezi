import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type CursoProgresso = { total: number; concluidas: number };

// RLS de aulas_concluidas já escopa a leitura só às linhas do próprio aluno
// (para QUALQUER matrícula dele) — não precisa de alunoId aqui. Se o aluno
// tiver mais de uma matrícula no mesmo curso (trocou de turma), a conclusão
// em qualquer uma delas conta — mesmo raciocínio de agregação por curso já
// usado em "Meus Cursos".
export async function getCursoProgresso(
  supabase: SupabaseServerClient,
  cursoId: string,
): Promise<CursoProgresso> {
  const { data: modulosData } = await supabase
    .from("modulos")
    .select("aulas(id)")
    .eq("curso_id", cursoId);

  const aulaIds = ((modulosData ?? []) as unknown as { aulas: { id: string }[] | null }[]).flatMap(
    (m) => m.aulas?.map((a) => a.id) ?? [],
  );

  if (aulaIds.length === 0) {
    return { total: 0, concluidas: 0 };
  }

  const { data: concluidasData } = await supabase
    .from("aulas_concluidas")
    .select("aula_id")
    .in("aula_id", aulaIds);

  const concluidasUnicas = new Set((concluidasData ?? []).map((c) => c.aula_id));

  return { total: aulaIds.length, concluidas: concluidasUnicas.size };
}
