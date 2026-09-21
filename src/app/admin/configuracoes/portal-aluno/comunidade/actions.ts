"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { resolverAutores } from "@/lib/comunidade/dados";
import {
  COMUNIDADE_STATUS,
  LIMITE_CONTEUDO_POST,
  LIMITE_DESCRICAO_CATEGORIA,
  LIMITE_ICONE_CATEGORIA,
  LIMITE_NOME_CATEGORIA,
  LIMITE_TITULO,
  REGEX_COR_HEX,
  type ComunidadeStatus,
} from "@/lib/comunidade/tipos";

const uuid = z.uuid({ error: "Identificador inválido." });
const statusSchema = z.enum(COMUNIDADE_STATUS, { error: "Status inválido." });

function revalidarTudo() {
  revalidatePath("/admin/configuracoes/portal-aluno/comunidade");
  revalidatePath("/aluno/comunidade", "layout");
  // O menu "Comunidade" da sidebar vive no layout do aluno.
  revalidatePath("/aluno", "layout");
}

type Resultado = { success: true } | { error: string };

// ===== configuração =====

export async function salvarConfigComunidade(dados: { ativo: boolean; alunosExcluem: boolean }): Promise<Resultado> {
  const user = await requireRole("admin");

  const parsed = z.object({ ativo: z.boolean(), alunosExcluem: z.boolean() }).safeParse(dados);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      portal_comunidade_ativo: parsed.data.ativo,
      portal_comunidade_alunos_excluem: parsed.data.alunosExcluem,
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Confira se a migration comunidade foi aplicada." };
  }

  revalidarTudo();
  return { success: true };
}

// ===== categorias =====

const categoriaSchema = z.object({
  id: uuid.optional(),
  nome: z
    .string()
    .trim()
    .min(1, { error: "Informe o nome da categoria." })
    .max(LIMITE_NOME_CATEGORIA, { error: `O nome pode ter no máximo ${LIMITE_NOME_CATEGORIA} caracteres.` }),
  descricao: z
    .string()
    .trim()
    .max(LIMITE_DESCRICAO_CATEGORIA, { error: `A descrição pode ter no máximo ${LIMITE_DESCRICAO_CATEGORIA} caracteres.` }),
  icone: z
    .string()
    .trim()
    .max(LIMITE_ICONE_CATEGORIA, { error: `O ícone pode ter no máximo ${LIMITE_ICONE_CATEGORIA} caracteres (use um emoji).` }),
  cor: z.string().regex(REGEX_COR_HEX, { error: "Cor inválida (use o formato #rrggbb)." }),
  somenteAdmin: z.boolean(),
  ativo: z.boolean(),
});

export type DadosCategoriaForm = z.input<typeof categoriaSchema>;

// Cria (sem id) ou edita (com id). Categoria nova entra no fim da ordem.
export async function salvarCategoria(dados: DadosCategoriaForm): Promise<Resultado> {
  await requireRole("admin");

  const parsed = categoriaSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  const supabase = await createClient();
  const campos = {
    nome: d.nome,
    descricao: d.descricao || null,
    icone: d.icone || null,
    cor: d.cor,
    somente_admin: d.somenteAdmin,
    ativo: d.ativo,
  };

  if (d.id) {
    const { data, error } = await supabase.from("comunidade_categorias").update(campos).eq("id", d.id).select("id");
    if (error) return { error: "Não foi possível salvar a categoria." };
    if (!data?.length) return { error: "Categoria não encontrada." };
  } else {
    const { data: ultima } = await supabase
      .from("comunidade_categorias")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("comunidade_categorias")
      .insert({ ...campos, ordem: ((ultima?.ordem as number | undefined) ?? 0) + 1 });
    if (error) return { error: "Não foi possível criar a categoria." };
  }

  revalidarTudo();
  return { success: true };
}

export async function alternarCategoriaAtiva(id: string, ativo: boolean): Promise<Resultado> {
  await requireRole("admin");

  if (!uuid.safeParse(id).success || typeof ativo !== "boolean") return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comunidade_categorias").update({ ativo }).eq("id", id).select("id");
  if (error) return { error: "Não foi possível atualizar a categoria." };
  if (!data?.length) return { error: "Categoria não encontrada." };

  revalidarTudo();
  return { success: true };
}

// Recebe TODOS os ids na nova ordem e grava ordem = posição (1..n).
export async function reordenarCategorias(ids: string[]): Promise<Resultado> {
  await requireRole("admin");

  const parsed = z.array(uuid).min(1).max(200).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { error: "Ordem inválida." };

  const supabase = await createClient();
  const resultados = await Promise.all(
    parsed.data.map((id, indice) => supabase.from("comunidade_categorias").update({ ordem: indice + 1 }).eq("id", id)),
  );
  if (resultados.some((r) => r.error)) return { error: "Não foi possível salvar a nova ordem." };

  revalidarTudo();
  return { success: true };
}

// ===== moderação de posts e respostas =====

export async function moderarPost(id: string, status: ComunidadeStatus): Promise<Resultado> {
  await requireRole("admin");

  if (!uuid.safeParse(id).success) return { error: "Post inválido." };
  const st = statusSchema.safeParse(status);
  if (!st.success) return { error: "Status inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comunidade_posts").update({ status: st.data }).eq("id", id).select("id");
  if (error) return { error: "Não foi possível atualizar o post." };
  if (!data?.length) return { error: "Post não encontrado." };

  revalidarTudo();
  return { success: true };
}

export async function fixarPost(id: string, fixado: boolean): Promise<Resultado> {
  await requireRole("admin");

  if (!uuid.safeParse(id).success || typeof fixado !== "boolean") return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comunidade_posts").update({ fixado }).eq("id", id).select("id");
  if (error) return { error: "Não foi possível atualizar o post." };
  if (!data?.length) return { error: "Post não encontrado." };

  revalidarTudo();
  return { success: true };
}

export async function moderarResposta(id: string, status: ComunidadeStatus): Promise<Resultado> {
  await requireRole("admin");

  if (!uuid.safeParse(id).success) return { error: "Resposta inválida." };
  const st = statusSchema.safeParse(status);
  if (!st.success) return { error: "Status inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comunidade_respostas").update({ status: st.data }).eq("id", id).select("id");
  if (error) return { error: "Não foi possível atualizar a resposta." };
  if (!data?.length) return { error: "Resposta não encontrada." };

  revalidarTudo();
  return { success: true };
}

export type RespostaAdminView = {
  id: string;
  autorNome: string;
  conteudo: string;
  status: ComunidadeStatus;
  createdAt: string;
};

// Carregada sob demanda (o admin expande "Respostas" no card do post).
export async function listarRespostasAdmin(
  postId: string,
): Promise<{ respostas: RespostaAdminView[] } | { error: string }> {
  await requireRole("admin");

  if (!uuid.safeParse(postId).success) return { error: "Post inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comunidade_respostas")
    .select("id, autor_id, conteudo, status, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) return { error: "Não foi possível carregar as respostas." };

  const linhas = (data ?? []) as { id: string; autor_id: string; conteudo: string; status: string; created_at: string }[];
  const autores = await resolverAutores(
    linhas.map((l) => l.autor_id),
    undefined,
    { nomeCompleto: true },
  );

  return {
    respostas: linhas.map((l) => ({
      id: l.id,
      autorNome: autores.get(l.autor_id)?.nome ?? "Aluno",
      conteudo: l.conteudo,
      status: (COMUNIDADE_STATUS as readonly string[]).includes(l.status) ? (l.status as ComunidadeStatus) : "ativo",
      createdAt: l.created_at,
    })),
  };
}

// ===== publicar como equipe =====

const avisoSchema = z.object({
  categoriaId: uuid,
  titulo: z
    .string()
    .trim()
    .min(1, { error: "Informe o título." })
    .max(LIMITE_TITULO, { error: `O título pode ter no máximo ${LIMITE_TITULO} caracteres.` }),
  conteudo: z
    .string()
    .trim()
    .min(1, { error: "Escreva o conteúdo." })
    .max(LIMITE_CONTEUDO_POST, { error: `O conteúdo pode ter no máximo ${LIMITE_CONTEUDO_POST} caracteres.` }),
  fixado: z.boolean(),
});

export async function publicarPostEquipe(dados: {
  categoriaId: string;
  titulo: string;
  conteudo: string;
  fixado: boolean;
}): Promise<Resultado> {
  const user = await requireRole("admin");

  const parsed = avisoSchema.safeParse(dados);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("comunidade_posts").insert({
    categoria_id: parsed.data.categoriaId,
    autor_id: user.id,
    titulo: parsed.data.titulo,
    conteudo: parsed.data.conteudo,
    fixado: parsed.data.fixado,
  });
  if (error) return { error: "Não foi possível publicar. Confira se a categoria existe e a migration foi aplicada." };

  revalidarTudo();
  return { success: true };
}
