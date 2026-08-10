import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AulaLiberacao = {
  liberada: boolean;
  motivoBloqueio: "calendario" | "sequencial" | null;
  dataLiberacao: string | null;
};

type CalendarioRow = {
  aula_id: string;
  numero_sessao: number;
  data_liberacao: string | null;
  liberada_calendario: boolean;
};

type ModuloComAulasRow = {
  numero: number;
  aulas: { id: string; numero: number }[] | null;
};

// Calcula, pra CADA aula do curso (numeração contínua — não reinicia por
// módulo), se está liberada pro aluno: precisa (1) a data da sessão no
// calendário da turma já ter passado, ou não haver cadência configurada
// (curso EAD / turma ainda sem cronograma), e (2) a aula anterior já ter
// sido concluída (a primeira aula do curso não depende de anterior).
//
// Uma única leva de queries pro curso inteiro — reaproveitável tanto pra
// listagem de um módulo quanto pra página de uma aula isolada, nunca
// por-aula.
export async function getLiberacaoAulasCurso(
  supabase: SupabaseServerClient,
  cursoId: string,
  turmaId: string,
): Promise<Map<string, AulaLiberacao>> {
  const [{ data: modulosData }, { data: calendarioData }] = await Promise.all([
    supabase
      .from("modulos")
      .select("numero, aulas(id, numero)")
      .eq("curso_id", cursoId)
      .order("numero")
      .order("numero", { referencedTable: "aulas" }),
    supabase.rpc("calendario_aulas_turma", { p_turma_id: turmaId }),
  ]);

  const aulaIdsOrdenados = ((modulosData ?? []) as unknown as ModuloComAulasRow[]).flatMap(
    (m) => m.aulas?.map((a) => a.id) ?? [],
  );

  const { data: concluidasData } =
    aulaIdsOrdenados.length > 0
      ? await supabase.from("aulas_concluidas").select("aula_id").in("aula_id", aulaIdsOrdenados)
      : { data: [] };

  const calendarioMap = new Map(
    ((calendarioData ?? []) as CalendarioRow[]).map((row) => [row.aula_id, row]),
  );
  const concluidasSet = new Set((concluidasData ?? []).map((c) => c.aula_id as string));

  // Function devolve zero linhas quando a turma não tem cadência
  // configurada (curso EAD, ou presencial/híbrido ainda sem cronograma) —
  // nesse caso o curso fica INTEIRAMENTE livre, sem checagem de calendário
  // NEM de sequência (não é só "calendário sempre liberado": a regra toda
  // não se aplica).
  const semCadencia = calendarioMap.size === 0;

  const resultado = new Map<string, AulaLiberacao>();
  let anteriorConcluida = true;

  for (const aulaId of aulaIdsOrdenados) {
    if (semCadencia) {
      resultado.set(aulaId, { liberada: true, motivoBloqueio: null, dataLiberacao: null });
      continue;
    }

    const calendarioRow = calendarioMap.get(aulaId);
    const liberadaPorCalendario = calendarioRow?.liberada_calendario ?? true;
    const liberadaPorSequencia = anteriorConcluida;
    const liberada = liberadaPorCalendario && liberadaPorSequencia;

    resultado.set(aulaId, {
      liberada,
      motivoBloqueio: liberada ? null : !liberadaPorSequencia ? "sequencial" : "calendario",
      dataLiberacao: calendarioRow?.data_liberacao ?? null,
    });

    anteriorConcluida = concluidasSet.has(aulaId);
  }

  return resultado;
}
