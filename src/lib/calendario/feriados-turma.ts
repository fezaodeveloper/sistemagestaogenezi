import type { createClient } from "@/lib/supabase/server";
import { adicionarDias } from "@/lib/datas/util";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Datas (YYYY-MM-DD) de feriados que afetam uma turma específica dentro de
// um período — abrangência "todos" sempre conta, "curso"/"turma" só se o id
// bater com a turma informada. Usado tanto pela ofensiva (gamificacao/ofensiva.ts)
// quanto pelo gerador de cronograma (cronograma/gerador.ts).
export async function getFeriadosTurma(
  supabase: SupabaseServerClient,
  options: { turmaId: string; cursoId: string; dataInicio: string; dataFim: string },
): Promise<Set<string>> {
  const { data } = await supabase
    .from("eventos_calendario")
    .select("data_inicio, data_fim, abrangencia, curso_id, turma_id")
    .eq("tipo", "feriado")
    .lte("data_inicio", options.dataFim)
    // Folga de 60 dias pra trás: cobre um feriado cujo data_fim (fim de um
    // recesso de vários dias) se estenda até dentro do período pedido,
    // mesmo com data_inicio anterior a ele.
    .gte("data_inicio", adicionarDias(options.dataInicio, -60));

  const datas = new Set<string>();
  for (const evento of data ?? []) {
    if (evento.abrangencia === "curso" && evento.curso_id !== options.cursoId) continue;
    if (evento.abrangencia === "turma" && evento.turma_id !== options.turmaId) continue;

    let cursor = evento.data_inicio as string;
    const fim = (evento.data_fim as string | null) ?? evento.data_inicio;
    while (cursor <= fim) {
      if (cursor >= options.dataInicio && cursor <= options.dataFim) datas.add(cursor);
      cursor = adicionarDias(cursor, 1);
    }
  }

  return datas;
}
