"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { presencaRowSchema } from "@/lib/presencas/schema";

export type RegistrarPresencasState = { error?: string } | undefined;

type MatriculaAluno = {
  id: string;
  alunos: { email: string; profiles: { full_name: string | null } | null } | null;
};

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

  // Revalida aula + a consistência aula (via módulo) .curso_id = turma.curso_id
  // — decisão de produto: só na aplicação, sem trigger no banco (ver CLAUDE.md).
  const [{ data: turma }, { data: aulaData }, { data: matriculasData }] = await Promise.all([
    supabase.from("turmas").select("id, curso_id").eq("id", turmaId).single(),
    supabase.from("aulas").select("id, modulos(curso_id)").eq("id", aulaId).single(),
    supabase
      .from("matriculas")
      .select("id, alunos(email, profiles!alunos_id_fkey(full_name))")
      .eq("turma_id", turmaId)
      .eq("status", "ativa"),
  ]);
  const aula = aulaData as unknown as { id: string; modulos: { curso_id: string } | null } | null;

  if (!turma || !aula || aula.modulos?.curso_id !== turma.curso_id) {
    return { error: "Aula inválida para esta turma." };
  }

  const matriculas = (matriculasData ?? []) as unknown as MatriculaAluno[];

  // O roster vem sempre do banco (não do formData) — evita que uma matrícula
  // adulterada ou desatualizada no cliente entre na chamada.
  const matriculaIds: string[] = [];
  const statuses: string[] = [];
  const dataReposicoes: (string | null)[] = [];
  const justificativas: (string | null)[] = [];
  const erros: string[] = [];

  for (const matricula of matriculas) {
    const status = formData.get(`status_${matricula.id}`);
    const parsed = presencaRowSchema.safeParse({
      status,
      justificativa: formData.get(`justificativa_${matricula.id}`) || undefined,
      data_reposicao: formData.get(`data_reposicao_${matricula.id}`) || undefined,
    });

    if (!parsed.success) {
      const nome = matricula.alunos?.profiles?.full_name || matricula.alunos?.email || "Aluno";
      const primeiroErro = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      erros.push(`${nome}: ${primeiroErro}`);
      continue;
    }

    matriculaIds.push(matricula.id);
    statuses.push(parsed.data.status);
    dataReposicoes.push(parsed.data.status === "reposicao" ? parsed.data.data_reposicao : null);
    justificativas.push(parsed.data.status === "justificada" ? parsed.data.justificativa : null);
  }

  if (erros.length > 0) {
    return { error: erros.join(" ") };
  }

  if (matriculaIds.length === 0) {
    return { error: "Nenhum aluno com matrícula ativa nesta turma." };
  }

  // RPC em vez de .upsert(): o upsert genérico do PostgREST reenvia todas as
  // colunas do payload no "on conflict do update", o que exigiria grant de
  // update em matricula_id/aula_id/data também. A function upsert_presencas
  // só atualiza status/data_reposicao/justificativa no conflito — ver
  // comentário na migration.
  const { error } = await supabase.rpc("upsert_presencas", {
    p_matricula_ids: matriculaIds,
    p_aula_id: aulaId,
    p_data: data,
    p_statuses: statuses,
    p_data_reposicoes: dataReposicoes,
    p_justificativas: justificativas,
  });

  if (error) {
    return { error: "Não foi possível salvar a chamada. Tente novamente." };
  }

  revalidatePath(`/admin/turmas/${turmaId}/presencas`);
  redirect(`/admin/turmas/${turmaId}/presencas`);
}
