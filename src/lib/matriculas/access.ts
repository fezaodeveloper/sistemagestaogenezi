import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Mesma regra de negócio usada na listagem "Meus Cursos": matrícula "ativa"
// ou "concluida" dá acesso ao conteúdo do curso. RLS permite a leitura das
// linhas independente do status (qualquer vínculo já dá visibilidade); esse
// filtro de status é regra de apresentação/acesso, não fronteira de RLS.
export async function alunoTemAcessoAoCurso(
  supabase: SupabaseServerClient,
  alunoId: string,
  cursoId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("matriculas")
    .select("id, turmas!inner(curso_id)")
    .eq("aluno_id", alunoId)
    .eq("turmas.curso_id", cursoId)
    .in("status", ["ativa", "concluida"])
    .limit(1);

  return !!data && data.length > 0;
}
