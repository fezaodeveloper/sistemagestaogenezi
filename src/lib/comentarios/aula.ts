import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import {
  iniciaisDoNome,
  isComentarioStatus,
  nomeAbreviado,
  type ComentarioAulaView,
} from "@/lib/comentarios/tipos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const LIMITE_COMENTARIOS_POR_AULA = 100;

export type ConfigComentarios = { ativo: boolean; moderacao: boolean };

// Lê as duas flags pela sessão do aluno (authenticated lê `configuracoes`). Erro — por
// exemplo a migration ainda não aplicada (coluna inexistente) — = recurso desligado, nunca
// exceção: a página da aula tem que continuar funcionando.
export async function getConfigComentarios(supabase: SupabaseServerClient): Promise<ConfigComentarios> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("portal_comentarios_ativo, portal_comentarios_moderacao")
    .maybeSingle();
  if (error || !data) return { ativo: false, moderacao: true };
  return {
    ativo: data.portal_comentarios_ativo === true,
    moderacao: data.portal_comentarios_moderacao !== false,
  };
}

type LinhaComentario = {
  id: string;
  aluno_id: string;
  texto: string;
  status: string;
  resposta_admin: string | null;
  respondido_at: string | null;
  created_at: string;
};

export type SecaoComentarios = {
  moderacao: boolean;
  comentarios: ComentarioAulaView[];
  // A lista falhou ao carregar (o formulário continua utilizável).
  erro: boolean;
};

// Dados da seção de comentários de uma aula, ou null quando o recurso está desligado.
// A RLS já devolve só o que o aluno pode ver (os aprovados da aula + os próprios em qualquer
// status); o client admin entra apenas para resolver NOMES dos autores (o aluno não lê o
// perfil dos colegas), e só para os ids que a consulta acima já liberou.
export async function getSecaoComentarios(
  supabase: SupabaseServerClient,
  aulaId: string,
  alunoId: string,
): Promise<SecaoComentarios | null> {
  const config = await getConfigComentarios(supabase);
  if (!config.ativo) return null;

  const { data, error } = await supabase
    .from("aula_comentarios")
    .select("id, aluno_id, texto, status, resposta_admin, respondido_at, created_at")
    .eq("aula_id", aulaId)
    .order("created_at", { ascending: false })
    .limit(LIMITE_COMENTARIOS_POR_AULA);

  if (error) return { moderacao: config.moderacao, comentarios: [], erro: true };

  const linhas = (data ?? []) as LinhaComentario[];
  const nomes = await resolverNomes(Array.from(new Set(linhas.map((l) => l.aluno_id))));

  const comentarios: ComentarioAulaView[] = linhas.map((linha) => {
    const proprio = linha.aluno_id === alunoId;
    const nomeCompleto = nomes.get(linha.aluno_id) ?? "";
    return {
      id: linha.id,
      autorNome: proprio ? nomeCompleto || "Você" : nomeAbreviado(nomeCompleto),
      iniciais: iniciaisDoNome(nomeCompleto),
      proprio,
      status: isComentarioStatus(linha.status) ? linha.status : "pendente",
      texto: linha.texto,
      respostaAdmin: linha.resposta_admin,
      respondidoAt: linha.respondido_at,
      createdAt: linha.created_at,
    };
  });

  return { moderacao: config.moderacao, comentarios, erro: false };
}

async function resolverNomes(ids: string[]): Promise<Map<string, string>> {
  const nomes = new Map<string, string>();
  if (ids.length === 0) return nomes;
  try {
    const { data } = await createAdminClient().from("profiles").select("id, full_name").in("id", ids);
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
      nomes.set(p.id, p.full_name?.trim() ?? "");
    }
  } catch {
    // Sem nomes o comentário ainda aparece (como "Aluno").
  }
  return nomes;
}
