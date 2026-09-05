"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { gerarCronogramaTurma } from "@/lib/cronograma/gerador";
import { adicionarDias } from "@/lib/datas/util";

export type TurmaCronogramaOpcao = {
  id: string;
  nome: string;
  curso_id: string;
  horario_aula: string | null;
  horario_fim: string | null;
};

export async function getTurmasParaCronograma(): Promise<TurmaCronogramaOpcao[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("turmas")
    .select("id, nome, curso_id, horario_aula, horario_fim")
    .eq("status", "ativa")
    .order("nome");

  return (data as TurmaCronogramaOpcao[] | null) ?? [];
}

export type CronogramaAulaRow = {
  id: string;
  turma_id: string;
  data_aula: string;
  eh_feriado: boolean;
  cancelada: boolean;
  observacoes: string | null;
  aulas: {
    numero: number;
    titulo: string;
    modulos: { numero: number; titulo: string } | null;
  } | null;
};

// inicio = segunda-feira da semana (YYYY-MM-DD); a semana exibida vai até
// sábado (+5 dias) — domingo fica de fora, mesma janela de dias da grade
// (Segunda a Sábado) pedida na tela.
export async function getCronogramaSemana(options: {
  turmaId?: string;
  inicio: string;
}): Promise<CronogramaAulaRow[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const fim = adicionarDias(options.inicio, 5);

  let query = supabase
    .from("cronograma_aulas")
    .select("*, aulas(numero, titulo, modulos(numero, titulo))")
    .gte("data_aula", options.inicio)
    .lte("data_aula", fim)
    .order("data_aula");

  if (options.turmaId) {
    query = query.eq("turma_id", options.turmaId);
  }

  const { data } = await query;
  return (data as CronogramaAulaRow[] | null) ?? [];
}

export async function regenerarCronograma(
  turmaId: string,
): Promise<{ criados: number } | { error: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const resultado = await gerarCronogramaTurma(turmaId, supabase);

  revalidatePath("/admin/cronograma");
  return resultado;
}
