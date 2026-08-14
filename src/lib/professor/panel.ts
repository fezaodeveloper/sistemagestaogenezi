import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MaterialPainel = {
  id: string;
  tipo: "pdf" | "video_youtube" | "slide" | "link";
  titulo: string;
  url: string;
};

export type AulaPainel = {
  id: string;
  numero: number;
  titulo: string;
  materiais: MaterialPainel[];
};

export type ModuloPainel = {
  id: string;
  numero: number;
  titulo: string;
  aulas: AulaPainel[];
};

export type AlunoPainel = { id: string; nome: string | null };

export type TurmaPainel = {
  id: string;
  nome: string;
  alunos: AlunoPainel[];
};

export type CursoPainel = {
  id: string;
  nome: string;
  modulos: ModuloPainel[];
  turmas: TurmaPainel[];
};

// Uma tela só, pensada pro professor abrir na TV/telão durante a aula
// presencial: curso -> módulo -> aula -> materiais, e turma -> alunos
// (atalho de chat). Várias queries simples em vez de um select aninhado
// gigante — mais fácil de acompanhar, e o volume de dados aqui é baixo
// (só cursos presenciais/híbridos ativos).
export async function getPainelProfessor(supabase: SupabaseServerClient): Promise<CursoPainel[]> {
  const { data: cursosData } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("status", "ativo")
    .neq("tipo", "ead")
    .order("nome");
  const cursos = cursosData ?? [];
  if (cursos.length === 0) return [];
  const cursoIds = cursos.map((c) => c.id);

  const [{ data: modulosData }, { data: turmasData }] = await Promise.all([
    supabase
      .from("modulos")
      .select("id, numero, titulo, curso_id")
      .in("curso_id", cursoIds)
      .order("numero"),
    supabase
      .from("turmas")
      .select("id, nome, curso_id")
      .in("curso_id", cursoIds)
      .eq("status", "ativa")
      .order("nome"),
  ]);
  const modulos = modulosData ?? [];
  const turmas = turmasData ?? [];
  const moduloIds = modulos.map((m) => m.id);
  const turmaIds = turmas.map((t) => t.id);

  const [{ data: aulasData }, { data: matriculasData }] = await Promise.all([
    moduloIds.length > 0
      ? supabase.from("aulas").select("id, numero, titulo, modulo_id").in("modulo_id", moduloIds).order("numero")
      : Promise.resolve({ data: [] }),
    turmaIds.length > 0
      ? supabase
          .from("matriculas")
          .select("id, aluno_id, turma_id, alunos!inner(profiles!alunos_id_fkey(full_name))")
          .in("turma_id", turmaIds)
          .eq("status", "ativa")
      : Promise.resolve({ data: [] }),
  ]);
  const aulas = aulasData ?? [];
  const aulaIds = aulas.map((a) => a.id);

  const { data: materiaisData } =
    aulaIds.length > 0
      ? await supabase
          .from("materiais")
          .select("id, tipo, titulo, url, ordem, aula_id")
          .in("aula_id", aulaIds)
          .in("tipo", ["pdf", "video_youtube"])
          .order("ordem")
      : { data: [] };
  const materiais = materiaisData ?? [];

  const matriculas = (matriculasData ?? []) as unknown as Array<{
    id: string;
    aluno_id: string;
    turma_id: string;
    alunos: { profiles: { full_name: string | null } | null } | null;
  }>;

  return cursos.map((curso) => ({
    id: curso.id,
    nome: curso.nome,
    modulos: modulos
      .filter((m) => m.curso_id === curso.id)
      .map((modulo) => ({
        id: modulo.id,
        numero: modulo.numero,
        titulo: modulo.titulo,
        aulas: aulas
          .filter((a) => a.modulo_id === modulo.id)
          .map((aula) => ({
            id: aula.id,
            numero: aula.numero,
            titulo: aula.titulo,
            materiais: materiais
              .filter((mat) => mat.aula_id === aula.id)
              .map((mat) => ({ id: mat.id, tipo: mat.tipo, titulo: mat.titulo, url: mat.url })),
          })),
      })),
    turmas: turmas
      .filter((t) => t.curso_id === curso.id)
      .map((turma) => ({
        id: turma.id,
        nome: turma.nome,
        alunos: matriculas
          .filter((m) => m.turma_id === turma.id)
          .map((m) => ({ id: m.aluno_id, nome: m.alunos?.profiles?.full_name ?? null })),
      })),
  }));
}
