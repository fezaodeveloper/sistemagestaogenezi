"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const idsSchema = z.object({
  matriculaId: z.uuid(),
  aulaId: z.uuid(),
});

export async function liberarAula(
  alunoId: string,
  matriculaId: string,
  aulaId: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = idsSchema.safeParse({ matriculaId, aulaId });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createClient();
  // ignoreDuplicates (on conflict do nothing): clicar de novo numa aula já
  // liberada não deve dar erro, só não faz nada.
  const { error } = await supabase
    .from("liberacoes_manuais")
    .upsert(
      { matricula_id: parsed.data.matriculaId, aula_id: parsed.data.aulaId },
      { onConflict: "matricula_id,aula_id", ignoreDuplicates: true },
    );

  if (error) {
    return { error: "Não foi possível liberar a aula. Tente novamente." };
  }

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}

const moduloSchema = z.object({
  matriculaId: z.uuid(),
  moduloId: z.uuid(),
});

// "Liberar o módulo inteiro" não é um conceito no schema — insere uma
// liberação por aula do módulo, em lote (upsert com ignoreDuplicates
// também aqui, pra poder clicar de novo mesmo se alguma aula já estava
// liberada individualmente).
export async function liberarModulo(
  alunoId: string,
  matriculaId: string,
  moduloId: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = moduloSchema.safeParse({ matriculaId, moduloId });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: aulas, error: aulasError } = await supabase
    .from("aulas")
    .select("id")
    .eq("modulo_id", parsed.data.moduloId);

  if (aulasError) {
    return { error: "Não foi possível carregar as aulas do módulo." };
  }
  if (!aulas || aulas.length === 0) {
    return { error: "Este módulo não tem aulas." };
  }

  const { error } = await supabase.from("liberacoes_manuais").upsert(
    aulas.map((a) => ({ matricula_id: parsed.data.matriculaId, aula_id: a.id })),
    { onConflict: "matricula_id,aula_id", ignoreDuplicates: true },
  );

  if (error) {
    return { error: "Não foi possível liberar o módulo. Tente novamente." };
  }

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}
