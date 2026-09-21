"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { enviarPushParaAluno } from "@/lib/push/enviar";
import { COMENTARIO_LIMITE_TEXTO } from "@/lib/comentarios/tipos";

const PAGINA = "/admin/configuracoes/portal-aluno/comentarios";

const idSchema = z.uuid({ error: "Comentário inválido." });

function revalidarTudo() {
  revalidatePath(PAGINA);
  // A seção dos alunos depende de comentários e das flags; o caminho tem parâmetros dinâmicos.
  revalidatePath("/aluno/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]", "page");
}

export async function salvarConfigComentarios(dados: {
  ativo: boolean;
  moderacao: boolean;
}): Promise<{ success: true } | { error: string }> {
  const user = await requireRole("admin");

  const parsed = z.object({ ativo: z.boolean(), moderacao: z.boolean() }).safeParse(dados);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      portal_comentarios_ativo: parsed.data.ativo,
      portal_comentarios_moderacao: parsed.data.moderacao,
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Confira se a migration aula_comentarios foi aplicada." };
  }

  revalidarTudo();
  return { success: true };
}

export async function moderarComentario(
  id: string,
  status: "aprovado" | "rejeitado",
): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  if (!idSchema.safeParse(id).success) return { error: "Comentário inválido." };
  if (status !== "aprovado" && status !== "rejeitado") return { error: "Status inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("aula_comentarios").update({ status }).eq("id", id).select("id");
  if (error) return { error: "Não foi possível atualizar o comentário." };
  if (!data?.length) return { error: "Comentário não encontrado." };

  revalidarTudo();
  return { success: true };
}

// Salva (ou apaga, se vazia) a resposta do admin. Quando há uma resposta NOVA (não vazia e
// diferente da anterior), o aluno recebe uma notificação push — best-effort: aluno sem
// dispositivo registrado, ou push não configurado, simplesmente não recebe nada.
export async function responderComentario(
  id: string,
  respostaBruta: string,
): Promise<{ success: true; notificados: number } | { error: string }> {
  await requireRole("admin");

  if (!idSchema.safeParse(id).success) return { error: "Comentário inválido." };

  const parsed = z
    .string()
    .trim()
    .max(COMENTARIO_LIMITE_TEXTO, { error: `A resposta pode ter no máximo ${COMENTARIO_LIMITE_TEXTO} caracteres.` })
    .safeParse(respostaBruta);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Resposta inválida." };
  const resposta = parsed.data;

  const supabase = await createClient();
  const { data: atual, error: erroLeitura } = await supabase
    .from("aula_comentarios")
    .select("id, aluno_id, resposta_admin, aulas(id, modulo_id, modulos(curso_id))")
    .eq("id", id)
    .maybeSingle();
  if (erroLeitura) return { error: "Não foi possível carregar o comentário." };
  if (!atual) return { error: "Comentário não encontrado." };

  const { data, error } = await supabase
    .from("aula_comentarios")
    .update({
      resposta_admin: resposta || null,
      respondido_at: resposta ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Não foi possível salvar a resposta." };
  if (!data?.length) return { error: "Comentário não encontrado." };

  let notificados = 0;
  if (resposta && resposta !== (atual.resposta_admin as string | null)) {
    const aula = (atual as unknown as {
      aulas: { id: string; modulo_id: string; modulos: { curso_id: string } | null } | null;
    }).aulas;
    const url = aula?.modulos
      ? `/aluno/cursos/${aula.modulos.curso_id}/modulos/${aula.modulo_id}/aulas/${aula.id}#comentarios`
      : "/aluno";
    const corpo = resposta.length > 120 ? `${resposta.slice(0, 117)}...` : resposta;
    notificados = await enviarPushParaAluno(atual.aluno_id as string, "Respondemos ao seu comentário", corpo, url);
  }

  revalidarTudo();
  return { success: true, notificados };
}

export async function excluirComentarioAdmin(id: string): Promise<{ success: true } | { error: string }> {
  await requireRole("admin");

  if (!idSchema.safeParse(id).success) return { error: "Comentário inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("aula_comentarios").delete().eq("id", id).select("id");
  if (error) return { error: "Não foi possível excluir o comentário." };
  if (!data?.length) return { error: "Comentário não encontrado." };

  revalidarTudo();
  return { success: true };
}
