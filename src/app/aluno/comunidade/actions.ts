"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getConfigComunidade } from "@/lib/comunidade/config";
import { LIMITE_CONTEUDO_POST, LIMITE_CONTEUDO_RESPOSTA, LIMITE_TITULO } from "@/lib/comunidade/tipos";

const uuid = z.uuid({ error: "Identificador inválido." });

const postSchema = z.object({
  categoriaId: uuid,
  titulo: z
    .string()
    .trim()
    .min(1, { error: "Informe o título." })
    .max(LIMITE_TITULO, { error: `O título pode ter no máximo ${LIMITE_TITULO} caracteres.` }),
  conteudo: z
    .string()
    .trim()
    .min(1, { error: "Escreva o conteúdo do post." })
    .max(LIMITE_CONTEUDO_POST, { error: `O conteúdo pode ter no máximo ${LIMITE_CONTEUDO_POST} caracteres.` }),
});

const respostaSchema = z.object({
  postId: uuid,
  conteudo: z
    .string()
    .trim()
    .min(1, { error: "Escreva sua resposta." })
    .max(LIMITE_CONTEUDO_RESPOSTA, { error: `A resposta pode ter no máximo ${LIMITE_CONTEUDO_RESPOSTA} caracteres.` }),
});

// Anti-spam simples por aluno.
const MAX_POSTS_POR_10_MIN = 5;
const MAX_RESPOSTAS_POR_MINUTO = 8;

function revalidarComunidade() {
  // "layout": cobre a página principal, as categorias e os posts.
  revalidatePath("/aluno/comunidade", "layout");
}

export async function criarPost(dados: {
  categoriaId: string;
  titulo: string;
  conteudo: string;
}): Promise<{ error: string } | { success: true; postId: string }> {
  const user = await requireRole("aluno");

  const parsed = postSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const config = await getConfigComunidade(supabase);
  if (!config.ativo) return { error: "A comunidade está desativada." };

  // A RLS já esconde categorias inativas do aluno; a checagem dá uma mensagem clara.
  const { data: categoria } = await supabase
    .from("comunidade_categorias")
    .select("id, somente_admin")
    .eq("id", parsed.data.categoriaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!categoria) return { error: "Categoria não encontrada." };
  if (categoria.somente_admin) return { error: "Somente a equipe publica nesta categoria." };

  const dezMinutosAtras = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await supabase
    .from("comunidade_posts")
    .select("id", { count: "exact", head: true })
    .eq("autor_id", user.id)
    .gte("created_at", dezMinutosAtras);
  if ((count ?? 0) >= MAX_POSTS_POR_10_MIN) {
    return { error: "Você publicou muitos posts em pouco tempo. Aguarde alguns minutos e tente de novo." };
  }

  const { data, error } = await supabase
    .from("comunidade_posts")
    .insert({
      categoria_id: parsed.data.categoriaId,
      autor_id: user.id,
      titulo: parsed.data.titulo,
      conteudo: parsed.data.conteudo,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível publicar o post. Tente novamente." };

  revalidarComunidade();
  return { success: true, postId: data.id as string };
}

export async function criarResposta(
  postId: string,
  conteudo: string,
): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("aluno");

  const parsed = respostaSchema.safeParse({ postId, conteudo });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const config = await getConfigComunidade(supabase);
  if (!config.ativo) return { error: "A comunidade está desativada." };

  // Só responde a post visível (ativo, em categoria ativa) — a RLS filtra.
  const { data: post } = await supabase
    .from("comunidade_posts")
    .select("id")
    .eq("id", parsed.data.postId)
    .eq("status", "ativo")
    .maybeSingle();
  if (!post) return { error: "Post não encontrado." };

  const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("comunidade_respostas")
    .select("id", { count: "exact", head: true })
    .eq("autor_id", user.id)
    .gte("created_at", umMinutoAtras);
  if ((count ?? 0) >= MAX_RESPOSTAS_POR_MINUTO) {
    return { error: "Você está respondendo rápido demais. Aguarde um instante e tente de novo." };
  }

  const { error } = await supabase
    .from("comunidade_respostas")
    .insert({ post_id: parsed.data.postId, autor_id: user.id, conteudo: parsed.data.conteudo });
  if (error) return { error: "Não foi possível publicar a resposta. Tente novamente." };

  revalidarComunidade();
  return { success: true };
}

// Exclusão é SOFT (status 'removido'): o conteúdo fica disponível para moderação. Sem
// RETURNING de propósito — depois do update a linha não é mais legível pelo aluno (a RLS de
// select só mostra 'ativo'), então a confirmação vem da contagem.
export async function excluirPost(postId: string): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("aluno");

  if (!uuid.safeParse(postId).success) return { error: "Post inválido." };

  const supabase = await createClient();
  const config = await getConfigComunidade(supabase);
  if (!config.alunosExcluem) return { error: "A exclusão de postagens está desativada." };

  const { error, count } = await supabase
    .from("comunidade_posts")
    .update({ status: "removido" }, { count: "exact" })
    .eq("id", postId)
    .eq("autor_id", user.id)
    .eq("status", "ativo");
  if (error) return { error: "Não foi possível excluir o post. Tente novamente." };
  if (!count) return { error: "Post não encontrado." };

  revalidarComunidade();
  return { success: true };
}

export async function excluirResposta(respostaId: string): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("aluno");

  if (!uuid.safeParse(respostaId).success) return { error: "Resposta inválida." };

  const supabase = await createClient();
  const config = await getConfigComunidade(supabase);
  if (!config.alunosExcluem) return { error: "A exclusão de postagens está desativada." };

  const { error, count } = await supabase
    .from("comunidade_respostas")
    .update({ status: "removido" }, { count: "exact" })
    .eq("id", respostaId)
    .eq("autor_id", user.id)
    .eq("status", "ativo");
  if (error) return { error: "Não foi possível excluir a resposta. Tente novamente." };
  if (!count) return { error: "Resposta não encontrada." };

  revalidarComunidade();
  return { success: true };
}

// Curtir/descurtir (toggle). O total vem do contador mantido por trigger no banco.
export async function alternarCurtida(
  alvo: "post" | "resposta",
  id: string,
): Promise<{ error: string } | { success: true; curtido: boolean; total: number }> {
  const user = await requireRole("aluno");

  if (alvo !== "post" && alvo !== "resposta") return { error: "Alvo inválido." };
  if (!uuid.safeParse(id).success) return { error: "Identificador inválido." };

  const supabase = await createClient();
  const config = await getConfigComunidade(supabase);
  if (!config.ativo) return { error: "A comunidade está desativada." };

  const coluna = alvo === "post" ? "post_id" : "resposta_id";
  const tabela = alvo === "post" ? "comunidade_posts" : "comunidade_respostas";

  const { data: existente } = await supabase
    .from("comunidade_curtidas")
    .select("id")
    .eq(coluna, id)
    .eq("aluno_id", user.id)
    .maybeSingle();

  let curtido: boolean;
  if (existente) {
    const { error } = await supabase.from("comunidade_curtidas").delete().eq("id", existente.id);
    if (error) return { error: "Não foi possível descurtir. Tente novamente." };
    curtido = false;
  } else {
    const { error } = await supabase.from("comunidade_curtidas").insert({ [coluna]: id, aluno_id: user.id });
    // 23505 = já curtido (duplo clique / outra aba): o resultado desejado já vale.
    if (error && error.code !== "23505") return { error: "Não foi possível curtir. Tente novamente." };
    curtido = true;
  }

  const { data: contador } = await supabase.from(tabela).select("total_curtidas").eq("id", id).maybeSingle();

  revalidarComunidade();
  return { success: true, curtido, total: (contador?.total_curtidas as number | undefined) ?? 0 };
}
