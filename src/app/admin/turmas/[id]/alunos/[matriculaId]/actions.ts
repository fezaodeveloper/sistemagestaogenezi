"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { presencaRowSchema } from "@/lib/presencas/schema";

export type PresencaAvulsaResult = { success: true } | { error: string };

export async function adicionarPresencaAvulsa(
  matriculaId: string,
  turmaId: string,
  formData: FormData,
): Promise<PresencaAvulsaResult> {
  await requireRole("admin");

  const aulaId = formData.get("aula_id");
  const data = formData.get("data");

  if (typeof aulaId !== "string" || !aulaId) {
    return { error: "Selecione a aula." };
  }
  if (typeof data !== "string" || !data) {
    return { error: "Informe a data." };
  }

  const parsed = presencaRowSchema.safeParse({
    status: formData.get("status"),
    justificativa: formData.get("justificativa") || undefined,
    data_reposicao: formData.get("data_reposicao") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  // Mesma validação de registrarPresencas (presencas/actions.ts): a aula
  // precisa pertencer ao curso da turma da matrícula, e a matrícula precisa
  // pertencer mesmo a essa turma — nunca confiar em ids vindos só do client.
  const [{ data: matricula }, { data: turma }, { data: aulaData }] = await Promise.all([
    supabase.from("matriculas").select("id, turma_id").eq("id", matriculaId).single(),
    supabase.from("turmas").select("id, curso_id").eq("id", turmaId).single(),
    supabase.from("aulas").select("id, modulos(curso_id)").eq("id", aulaId).single(),
  ]);
  const aula = aulaData as unknown as { id: string; modulos: { curso_id: string } | null } | null;

  if (!matricula || matricula.turma_id !== turmaId) {
    return { error: "Matrícula inválida para esta turma." };
  }
  if (!turma || !aula || aula.modulos?.curso_id !== turma.curso_id) {
    return { error: "Aula inválida para esta turma." };
  }

  // Mesma RPC usada por registrarPresencas (presencas/actions.ts), com
  // arrays de 1 elemento — upsert_presencas já resolve o conflito
  // (matricula_id, aula_id, data) atualizando a linha existente.
  const { error } = await supabase.rpc("upsert_presencas", {
    p_matricula_ids: [matriculaId],
    p_aula_id: aulaId,
    p_data: data,
    p_statuses: [parsed.data.status],
    p_data_reposicoes: [parsed.data.status === "reposicao" ? parsed.data.data_reposicao : null],
    p_justificativas: [parsed.data.status === "justificada" ? parsed.data.justificativa : null],
  });

  if (error) {
    return { error: "Não foi possível salvar a presença. Tente novamente." };
  }

  revalidatePath(`/admin/turmas/${turmaId}/alunos/${matriculaId}`);
  return { success: true };
}

export async function editarPresenca(
  presencaId: string,
  matriculaId: string,
  turmaId: string,
  formData: FormData,
): Promise<PresencaAvulsaResult> {
  await requireRole("admin");

  const parsed = presencaRowSchema.safeParse({
    status: formData.get("status"),
    justificativa: formData.get("justificativa") || undefined,
    data_reposicao: formData.get("data_reposicao") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("presencas")
    .update({
      status: parsed.data.status,
      data_reposicao: parsed.data.status === "reposicao" ? parsed.data.data_reposicao : null,
      justificativa: parsed.data.status === "justificada" ? parsed.data.justificativa : null,
    })
    .eq("id", presencaId)
    .eq("matricula_id", matriculaId);

  if (error) {
    return { error: "Não foi possível atualizar a presença. Tente novamente." };
  }

  revalidatePath(`/admin/turmas/${turmaId}/alunos/${matriculaId}`);
  return { success: true };
}
