import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// TAREFA fix cursos por turma — matriculas.curso_id é a fonte de verdade de "qual curso ESTE
// aluno escolheu" (turma_cursos define só o que a turma OFERECE, não o que o aluno faz). Bug
// real corrigido aqui: as 3 funções abaixo filtravam por turmas.curso_id (o "curso principal" da
// turma) — um aluno matriculado numa turma de 2+ cursos, que escolheu o curso SECUNDÁRIO, ficava
// SEM acesso ao próprio conteúdo (e com acesso indevido ao curso principal, que nunca escolheu).
// curso_id null = matrícula antiga (antes desta coluna existir) ou turma de 1 curso só — nesses
// casos cai no fallback de turmas.curso_id (compatibilidade legada, nunca o inverso).
type MatriculaCursoRow = { curso_id: string | null; turmas: { curso_id: string | null } | null };

function cursoEfetivoId(row: MatriculaCursoRow): string | null {
  return row.curso_id ?? row.turmas?.curso_id ?? null;
}

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
    .select("curso_id, turmas(curso_id)")
    .eq("aluno_id", alunoId)
    .in("status", ["ativa", "concluida"]);

  return ((data ?? []) as unknown as MatriculaCursoRow[]).some((row) => cursoEfetivoId(row) === cursoId);
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
    .select("id, created_at, curso_id, turmas(curso_id)")
    .eq("aluno_id", alunoId)
    .in("status", ["ativa", "concluida"])
    .order("created_at", { ascending: false });

  type Row = MatriculaCursoRow & { id: string };
  const encontrada = ((data ?? []) as unknown as Row[]).find((row) => cursoEfetivoId(row) === cursoId);
  return encontrada?.id ?? null;
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
    .select("id, created_at, turma_id, curso_id, turmas(curso_id)")
    .eq("aluno_id", alunoId)
    .in("status", ["ativa", "concluida"])
    .order("created_at", { ascending: false });

  type Row = MatriculaCursoRow & { id: string; turma_id: string };
  const encontrada = ((data ?? []) as unknown as Row[]).find((row) => cursoEfetivoId(row) === cursoId);
  return encontrada ? { id: encontrada.id, turmaId: encontrada.turma_id } : null;
}

// Presencial/híbrido = tipo <> 'ead' — mesmo critério usado pro streak de
// gamificação e agora pro chat interno (Fase 11). Movida de
// lib/gamificacao/streak.ts pra cá, lugar mais neutro já que passou a ter
// mais de um consumidor fora do domínio de gamificação.
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
