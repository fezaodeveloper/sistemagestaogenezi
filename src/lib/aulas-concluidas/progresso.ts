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

export type ModuloProgresso = { total: number; concluidas: number };

// Progresso de aulas concluídas por módulo — usado nos cards de módulo da
// página do curso e na barra de progresso do topo da página de aulas do
// módulo. Mesma estratégia de getCursoProgresso (busca módulos+aulas do
// curso, depois aulas_concluidas), só que agregando por módulo em vez de
// somar tudo num total só.
export async function getModulosProgresso(
  supabase: SupabaseServerClient,
  cursoId: string,
  matriculaId: string | null,
): Promise<Map<string, ModuloProgresso>> {
  const { data: modulosData } = await supabase
    .from("modulos")
    .select("id, aulas(id)")
    .eq("curso_id", cursoId);

  const modulos = (modulosData ?? []) as unknown as {
    id: string;
    aulas: { id: string }[] | null;
  }[];

  const progresso = new Map<string, ModuloProgresso>();
  const todasAulaIds: string[] = [];

  for (const modulo of modulos) {
    const aulaIds = modulo.aulas?.map((a) => a.id) ?? [];
    progresso.set(modulo.id, { total: aulaIds.length, concluidas: 0 });
    todasAulaIds.push(...aulaIds);
  }

  const concluidasIds = await getAulasConcluidasIds(supabase, todasAulaIds, matriculaId);
  if (concluidasIds.size === 0) return progresso;

  for (const modulo of modulos) {
    const aulaIds = modulo.aulas?.map((a) => a.id) ?? [];
    progresso.set(modulo.id, {
      total: aulaIds.length,
      concluidas: aulaIds.filter((id) => concluidasIds.has(id)).length,
    });
  }

  return progresso;
}

// Ids das aulas (dentre um conjunto dado) já concluídas por uma matrícula —
// usado tanto pra decidir "módulo 100% concluído" (aulas/[aulaId]/page.tsx,
// gate de exibição do pill da prova) quanto pra marcar ✅/⭕ na lista de
// aulas do módulo (aulas/[aulaId]/page.tsx e modulos/[moduloId]/page.tsx).
export async function getAulasConcluidasIds(
  supabase: SupabaseServerClient,
  aulaIds: string[],
  matriculaId: string | null,
): Promise<Set<string>> {
  if (!matriculaId || aulaIds.length === 0) return new Set();

  const { data } = await supabase
    .from("aulas_concluidas")
    .select("aula_id")
    .in("aula_id", aulaIds)
    .eq("matricula_id", matriculaId);

  return new Set((data ?? []).map((row) => row.aula_id as string));
}
