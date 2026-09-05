import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { adicionarDias, diaDaSemana } from "@/lib/datas/util";
import { getFeriadosTurma } from "@/lib/calendario/feriados-turma";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ModuloComAulasRow = {
  numero: number;
  aulas: { id: string; numero: number }[] | null;
};

export type GerarCronogramaResultado = { criados: number } | { error: string };

// Gera o cronograma de uma turma: distribui as aulas do curso (numeração
// contínua por módulo.numero/aula.numero) sequencialmente nas datas que
// batem com a cadência semanal da turma, entre data_inicio e data_fim.
// Diferente de calendario_aulas_turma() (function SQL que já existe e
// governa a LIBERAÇÃO de conteúdo pro aluno — ver src/lib/cronograma/liberacao.ts),
// esta geração é só uma visão de planejamento pro admin: marca eh_feriado
// quando a data calculada cai num feriado cadastrado, mas não desloca a
// aula pra outro dia por causa disso — é um aviso visual, não um recálculo
// automático de calendário. Apaga e recria tudo da turma (idempotente).
export async function gerarCronogramaTurma(
  turmaId: string,
  supabase: SupabaseServerClient,
): Promise<GerarCronogramaResultado> {
  const { data: turma } = await supabase
    .from("turmas")
    .select("cadencia_dias_semana, data_inicio, data_fim, curso_id")
    .eq("id", turmaId)
    .maybeSingle();

  // Curso EAD (ou turma ainda sem cadência configurada) não tem cronograma
  // fixo — limpa o que existir (ex.: turma que tinha cadência e teve o
  // curso trocado pra EAD) e sai sem erro.
  if (!turma || !turma.cadencia_dias_semana || turma.cadencia_dias_semana.length === 0) {
    await supabase.from("cronograma_aulas").delete().eq("turma_id", turmaId);
    return { criados: 0 };
  }

  const { data: modulosData } = await supabase
    .from("modulos")
    .select("numero, aulas(id, numero)")
    .eq("curso_id", turma.curso_id)
    .order("numero")
    .order("numero", { referencedTable: "aulas" });

  const aulaIdsOrdenados = ((modulosData ?? []) as ModuloComAulasRow[]).flatMap(
    (modulo) => modulo.aulas?.map((aula) => aula.id) ?? [],
  );

  if (aulaIdsOrdenados.length === 0) {
    await supabase.from("cronograma_aulas").delete().eq("turma_id", turmaId);
    return { criados: 0 };
  }

  const feriados = await getFeriadosTurma(supabase, {
    turmaId,
    cursoId: turma.curso_id,
    dataInicio: turma.data_inicio,
    dataFim: turma.data_fim,
  });

  const cadencia = new Set(turma.cadencia_dias_semana);
  const datasDeAula: string[] = [];
  for (
    let dia = turma.data_inicio;
    dia <= turma.data_fim && datasDeAula.length < aulaIdsOrdenados.length;
    dia = adicionarDias(dia, 1)
  ) {
    if (cadencia.has(diaDaSemana(dia))) datasDeAula.push(dia);
  }

  const linhas = aulaIdsOrdenados.slice(0, datasDeAula.length).map((aulaId, indice) => ({
    turma_id: turmaId,
    aula_id: aulaId,
    data_aula: datasDeAula[indice],
    eh_feriado: feriados.has(datasDeAula[indice]),
  }));

  await supabase.from("cronograma_aulas").delete().eq("turma_id", turmaId);

  if (linhas.length === 0) return { criados: 0 };

  const { error } = await supabase.from("cronograma_aulas").insert(linhas);
  if (error) return { error: "Não foi possível gerar o cronograma." };

  return { criados: linhas.length };
}

// Best-effort: chamado a partir de createTurma/updateTurma — nunca deve
// impedir o salvamento da turma se a geração do cronograma falhar.
export async function regenerarCronogramaAoSalvarTurma(
  turmaId: string,
  supabase: SupabaseServerClient,
): Promise<void> {
  try {
    await gerarCronogramaTurma(turmaId, supabase);
  } catch {
    // Best-effort — a turma já foi salva com sucesso antes desta chamada.
  }
}
