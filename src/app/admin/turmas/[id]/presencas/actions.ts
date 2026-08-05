"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PRESENCA_STATUSES } from "@/lib/presencas/schema";

export type RegistrarPresencasState = { error?: string } | undefined;

export async function registrarPresencas(
  turmaId: string,
  aulaId: string,
  data: string,
  _prevState: RegistrarPresencasState,
  formData: FormData,
): Promise<RegistrarPresencasState> {
  await requireRole("admin");

  if (!data) {
    return { error: "Informe a data da chamada." };
  }

  const supabase = await createClient();

  // Revalida aula + a consistência aula.curso_id = turma.curso_id — decisão
  // de produto: só na aplicação, sem trigger no banco (ver CLAUDE.md).
  const [{ data: turma }, { data: aula }, { data: matriculas }] = await Promise.all([
    supabase.from("turmas").select("id, curso_id").eq("id", turmaId).single(),
    supabase.from("aulas").select("id, curso_id").eq("id", aulaId).single(),
    supabase.from("matriculas").select("id").eq("turma_id", turmaId).eq("status", "ativa"),
  ]);

  if (!turma || !aula || aula.curso_id !== turma.curso_id) {
    return { error: "Aula inválida para esta turma." };
  }

  // O roster vem sempre do banco (não do formData) — evita que uma matrícula
  // adulterada ou desatualizada no cliente entre na chamada.
  const rows = (matriculas ?? []).flatMap((matricula) => {
    const status = formData.get(`status_${matricula.id}`);
    if (
      typeof status !== "string" ||
      !PRESENCA_STATUSES.includes(status as (typeof PRESENCA_STATUSES)[number])
    ) {
      return [];
    }
    return [{ matricula_id: matricula.id, aula_id: aulaId, data, status }];
  });

  if (rows.length === 0) {
    return { error: "Nenhum aluno com matrícula ativa nesta turma." };
  }

  // RPC em vez de .upsert(): o upsert genérico do PostgREST reenvia todas as
  // colunas do payload no "on conflict do update", o que exigiria grant de
  // update além de "status". A function upsert_presencas só atualiza
  // "status" no conflito — ver comentário na migration.
  const { error } = await supabase.rpc("upsert_presencas", {
    p_matricula_ids: rows.map((row) => row.matricula_id),
    p_aula_id: aulaId,
    p_data: data,
    p_statuses: rows.map((row) => row.status),
  });

  if (error) {
    return { error: "Não foi possível salvar a chamada. Tente novamente." };
  }

  revalidatePath(`/admin/turmas/${turmaId}/presencas`);
  redirect(`/admin/turmas/${turmaId}/presencas`);
}
