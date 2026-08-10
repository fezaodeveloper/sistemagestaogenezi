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

// Usada ao MARCAR uma aula como concluída — precisa de uma matricula_id
// concreta pra gravar em aulas_concluidas (FK not null). Se o aluno tiver
// mais de uma matrícula ativa/concluída pro mesmo curso (trocou de turma),
// usa a mais recente; não importa muito qual, já que o cálculo de progresso
// agrega a conclusão por curso, não por matrícula específica.
export async function getMatriculaIdAtivaParaCurso(
  supabase: SupabaseServerClient,
  alunoId: string,
  cursoId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("matriculas")
    .select("id, created_at, turmas!inner(curso_id)")
    .eq("aluno_id", alunoId)
    .eq("turmas.curso_id", cursoId)
    .in("status", ["ativa", "concluida"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

// Variante usada só onde o calendário de liberação (cronograma) precisa ser
// calculado — além da matrícula, também precisa de turma_id pra buscar
// cadencia_dias_semana/data_inicio. Query separada da acima (em vez de
// mudar o retorno dela) pra não afetar os call sites existentes que só
// precisam do id.
export async function getMatriculaAtivaComTurma(
  supabase: SupabaseServerClient,
  alunoId: string,
  cursoId: string,
): Promise<{ id: string; turmaId: string } | null> {
  const { data } = await supabase
    .from("matriculas")
    .select("id, created_at, turma_id, turmas!inner(curso_id)")
    .eq("aluno_id", alunoId)
    .eq("turmas.curso_id", cursoId)
    .in("status", ["ativa", "concluida"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { id: data.id, turmaId: data.turma_id } : null;
}

export type ExpiracaoMatricula = { expirada: boolean; dataExpiracao: string };

// O booleano vem de uma function SQL (matricula_expirada), não de comparar
// Date em JS — mesma disciplina já aplicada no cronograma: current_date do
// Postgres e new Date() do Node podem divergir por fuso horário, então só
// o banco decide "expirou ou não". A data crua (dataExpiracao) é só pra
// exibição da mensagem.
export async function getExpiracaoMatricula(
  supabase: SupabaseServerClient,
  matriculaId: string,
): Promise<ExpiracaoMatricula | null> {
  const [{ data: matricula }, { data: expirada }] = await Promise.all([
    supabase.from("matriculas").select("data_expiracao").eq("id", matriculaId).single(),
    supabase.rpc("matricula_expirada", { p_matricula_id: matriculaId }),
  ]);

  if (!matricula) return null;

  return { expirada: !!expirada, dataExpiracao: matricula.data_expiracao };
}
