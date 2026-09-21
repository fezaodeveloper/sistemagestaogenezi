import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { iniciaisDoNome, nomeAbreviado } from "@/lib/comentarios/tipos";
import {
  ICONE_PADRAO,
  COR_CATEGORIA_PADRAO,
  previewTexto,
  type AutorView,
  type CategoriaView,
  type PostResumoView,
  type RespostaView,
} from "@/lib/comunidade/tipos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ===== autores =====

// Nomes via client ADMIN: o aluno não lê o perfil dos colegas (RLS de profiles). Só é chamado
// com ids que uma consulta protegida por RLS já liberou. Colegas aparecem abreviados
// ("Maria S." — LGPD), o próprio aluno com nome inteiro e o admin como "Equipe".
export async function resolverAutores(
  ids: string[],
  eu?: string,
  opcoes?: { nomeCompleto?: boolean },
): Promise<Map<string, AutorView>> {
  const autores = new Map<string, AutorView>();
  const unicos = Array.from(new Set(ids));
  if (unicos.length === 0) return autores;

  try {
    const { data } = await createAdminClient().from("profiles").select("id, full_name, role").in("id", unicos);
    for (const p of (data ?? []) as { id: string; full_name: string | null; role: string | null }[]) {
      const nome = p.full_name?.trim() ?? "";
      if (p.role === "admin") {
        autores.set(p.id, { nome: "Equipe", iniciais: "EQ", equipe: true });
      } else {
        autores.set(p.id, {
          nome: opcoes?.nomeCompleto || p.id === eu ? nome || (p.id === eu ? "Você" : "Aluno") : nomeAbreviado(nome),
          iniciais: iniciaisDoNome(nome),
          equipe: false,
        });
      }
    }
  } catch {
    // Sem nomes o conteúdo ainda aparece (como "Aluno").
  }
  return autores;
}

export function autorPadrao(autores: Map<string, AutorView>, id: string): AutorView {
  return autores.get(id) ?? { nome: "Aluno", iniciais: "?", equipe: false };
}

// ===== categorias =====

type LinhaCategoria = {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  somente_admin: boolean;
};

export const COLUNAS_CATEGORIA = "id, nome, descricao, icone, cor, ordem, ativo, somente_admin";

export function paraCategoriaView(linha: LinhaCategoria, totalPosts: number): CategoriaView {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    icone: linha.icone?.trim() || ICONE_PADRAO,
    cor: linha.cor || COR_CATEGORIA_PADRAO,
    ordem: linha.ordem,
    ativo: linha.ativo,
    somenteAdmin: linha.somente_admin,
    totalPosts,
  };
}

// Posts ativos por categoria (uma contagem por categoria — são poucas). A RLS do aluno já
// restringe a posts ativos; o filtro de status deixa a mesma regra valendo pro admin.
export async function contarPostsPorCategoria(
  supabase: SupabaseServerClient,
  categoriaIds: string[],
): Promise<Map<string, number>> {
  const contagens = await Promise.all(
    categoriaIds.map(async (id) => {
      const { count } = await supabase
        .from("comunidade_posts")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", id)
        .eq("status", "ativo");
      return [id, count ?? 0] as const;
    }),
  );
  return new Map(contagens);
}

export async function listarCategoriasAluno(
  supabase: SupabaseServerClient,
): Promise<{ categorias: CategoriaView[]; erro: boolean }> {
  const { data, error } = await supabase
    .from("comunidade_categorias")
    .select(COLUNAS_CATEGORIA)
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  if (error) return { categorias: [], erro: true };

  const linhas = (data ?? []) as LinhaCategoria[];
  const totais = await contarPostsPorCategoria(
    supabase,
    linhas.map((l) => l.id),
  );
  return { categorias: linhas.map((l) => paraCategoriaView(l, totais.get(l.id) ?? 0)), erro: false };
}

// ===== posts =====

type LinhaPost = {
  id: string;
  categoria_id: string;
  autor_id: string;
  titulo: string;
  conteudo: string;
  fixado: boolean;
  total_respostas: number;
  total_curtidas: number;
  created_at: string;
  ultima_atividade_at: string;
  comunidade_categorias: { nome: string; icone: string | null; cor: string | null } | null;
};

export const COLUNAS_POST =
  "id, categoria_id, autor_id, titulo, conteudo, fixado, total_respostas, total_curtidas, created_at, ultima_atividade_at, comunidade_categorias(nome, icone, cor)";

async function montarResumos(linhas: LinhaPost[], eu: string): Promise<PostResumoView[]> {
  const autores = await resolverAutores(
    linhas.map((l) => l.autor_id),
    eu,
  );
  return linhas.map((l) => ({
    id: l.id,
    categoriaId: l.categoria_id,
    categoriaNome: l.comunidade_categorias?.nome ?? "Categoria",
    categoriaIcone: l.comunidade_categorias?.icone?.trim() || ICONE_PADRAO,
    categoriaCor: l.comunidade_categorias?.cor || COR_CATEGORIA_PADRAO,
    titulo: l.titulo,
    preview: previewTexto(l.conteudo),
    autor: autorPadrao(autores, l.autor_id),
    fixado: l.fixado,
    totalRespostas: l.total_respostas,
    totalCurtidas: l.total_curtidas,
    createdAt: l.created_at,
    ultimaAtividadeAt: l.ultima_atividade_at,
  }));
}

export async function listarPostsFixados(
  supabase: SupabaseServerClient,
  eu: string,
): Promise<{ posts: PostResumoView[]; erro: boolean }> {
  const { data, error } = await supabase
    .from("comunidade_posts")
    .select(COLUNAS_POST)
    .eq("status", "ativo")
    .eq("fixado", true)
    .order("ultima_atividade_at", { ascending: false })
    .limit(10);
  if (error) return { posts: [], erro: true };
  return { posts: await montarResumos((data ?? []) as unknown as LinhaPost[], eu), erro: false };
}

// Feed geral: os posts com atividade mais recente (os fixados já aparecem no bloco próprio).
export async function listarFeedRecente(
  supabase: SupabaseServerClient,
  eu: string,
  limite = 15,
): Promise<{ posts: PostResumoView[]; erro: boolean }> {
  const { data, error } = await supabase
    .from("comunidade_posts")
    .select(COLUNAS_POST)
    .eq("status", "ativo")
    .eq("fixado", false)
    .order("ultima_atividade_at", { ascending: false })
    .limit(limite);
  if (error) return { posts: [], erro: true };
  return { posts: await montarResumos((data ?? []) as unknown as LinhaPost[], eu), erro: false };
}

export async function listarPostsDaCategoria(
  supabase: SupabaseServerClient,
  categoriaId: string,
  eu: string,
  offset: number,
  limite: number,
): Promise<{ posts: PostResumoView[]; total: number; erro: boolean }> {
  const { data, error, count } = await supabase
    .from("comunidade_posts")
    .select(COLUNAS_POST, { count: "exact" })
    .eq("categoria_id", categoriaId)
    .eq("status", "ativo")
    .order("fixado", { ascending: false })
    .order("ultima_atividade_at", { ascending: false })
    .range(offset, offset + limite - 1);
  if (error) return { posts: [], total: 0, erro: true };
  return { posts: await montarResumos((data ?? []) as unknown as LinhaPost[], eu), total: count ?? 0, erro: false };
}

export type PostCompletoView = PostResumoView & {
  conteudo: string;
  proprio: boolean;
  curtido: boolean;
};

export async function getPostCompleto(
  supabase: SupabaseServerClient,
  postId: string,
  eu: string,
): Promise<PostCompletoView | null> {
  const { data } = await supabase
    .from("comunidade_posts")
    .select(COLUNAS_POST)
    .eq("id", postId)
    .eq("status", "ativo")
    .maybeSingle();
  if (!data) return null;

  const linha = data as unknown as LinhaPost;
  const [[resumo], { data: minhaCurtida }] = await Promise.all([
    montarResumos([linha], eu),
    supabase.from("comunidade_curtidas").select("id").eq("post_id", postId).eq("aluno_id", eu).maybeSingle(),
  ]);

  return { ...resumo, conteudo: linha.conteudo, proprio: linha.autor_id === eu, curtido: !!minhaCurtida };
}

// ===== respostas =====

type LinhaResposta = {
  id: string;
  autor_id: string;
  conteudo: string;
  total_curtidas: number;
  created_at: string;
};

const LIMITE_RESPOSTAS_POR_POST = 300;

export async function listarRespostas(
  supabase: SupabaseServerClient,
  postId: string,
  eu: string,
): Promise<{ respostas: RespostaView[]; erro: boolean }> {
  const { data, error } = await supabase
    .from("comunidade_respostas")
    .select("id, autor_id, conteudo, total_curtidas, created_at")
    .eq("post_id", postId)
    .eq("status", "ativo")
    .order("created_at", { ascending: true })
    .limit(LIMITE_RESPOSTAS_POR_POST);
  if (error) return { respostas: [], erro: true };

  const linhas = (data ?? []) as LinhaResposta[];
  if (linhas.length === 0) return { respostas: [], erro: false };

  const [autores, { data: minhas }] = await Promise.all([
    resolverAutores(
      linhas.map((l) => l.autor_id),
      eu,
    ),
    supabase
      .from("comunidade_curtidas")
      .select("resposta_id")
      .eq("aluno_id", eu)
      .in(
        "resposta_id",
        linhas.map((l) => l.id),
      ),
  ]);
  const curtidas = new Set(((minhas ?? []) as { resposta_id: string | null }[]).map((c) => c.resposta_id));

  return {
    respostas: linhas.map((l) => ({
      id: l.id,
      autor: autorPadrao(autores, l.autor_id),
      proprio: l.autor_id === eu,
      conteudo: l.conteudo,
      totalCurtidas: l.total_curtidas,
      curtido: curtidas.has(l.id),
      createdAt: l.created_at,
    })),
    erro: false,
  };
}
