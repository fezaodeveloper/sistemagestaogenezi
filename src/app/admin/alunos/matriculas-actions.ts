"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { matriculaFormSchema, MATRICULA_STATUSES } from "@/lib/matriculas/schema";
import { enviarMensagemMatriculaCriada } from "@/lib/mensagens/mensagens";

export type MatriculaFormState =
  { errors?: Partial<Record<"turma_id" | "data_matricula", string[]>>; error?: string } | undefined;

export async function createMatricula(
  alunoId: string,
  _prevState: MatriculaFormState,
  formData: FormData,
): Promise<MatriculaFormState> {
  const user = await requireRole("admin");

  const parsed = matriculaFormSchema.safeParse({
    turma_id: formData.get("turma_id"),
    data_matricula: formData.get("data_matricula"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: novaMatricula, error } = await supabase
    .from("matriculas")
    .insert({
      aluno_id: alunoId,
      turma_id: parsed.data.turma_id,
      data_matricula: parsed.data.data_matricula,
      status: "ativa",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "O aluno já tem uma matrícula ativa nessa turma." };
    }
    return { error: "Não foi possível criar a matrícula. Tente novamente." };
  }

  // Best-effort, nunca bloqueia a matrícula (já criada com sucesso acima) —
  // ver política de falhas em enviarMensagemMatriculaCriada.
  if (novaMatricula) {
    await enviarMensagemMatriculaCriada(novaMatricula.id, user.id);
  }

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return undefined;
}

export async function updateMatriculaStatus(
  matriculaId: string,
  alunoId: string,
  status: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  if (!MATRICULA_STATUSES.includes(status as (typeof MATRICULA_STATUSES)[number])) {
    return { error: "Status inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("matriculas").update({ status }).eq("id", matriculaId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma matrícula ativa do aluno nessa turma." };
    }
    return { error: "Não foi possível atualizar o status da matrícula. Tente novamente." };
  }

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}

export async function updateMatriculaExpiracao(
  matriculaId: string,
  alunoId: string,
  dataExpiracao: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  if (!dataExpiracao) {
    return { error: "Informe a data de expiração." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("matriculas")
    .update({ data_expiracao: dataExpiracao })
    .eq("id", matriculaId);

  if (error) {
    return { error: "Não foi possível atualizar a data de expiração. Tente novamente." };
  }

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}

export async function deleteMatricula(
  matriculaId: string,
  alunoId: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("matriculas").delete().eq("id", matriculaId);

  if (error) {
    return { error: "Não foi possível excluir a matrícula. Tente novamente." };
  }

  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {};
}
