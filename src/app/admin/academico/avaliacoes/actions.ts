"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, parseLimite, parsePagina } from "@/lib/paginacao";
import { nomeAbreviado } from "@/lib/comentarios/tipos";

export type AvaliacaoIndividualView = {
  id: string;
  alunoNome: string;
  nota: number;
  comentario: string | null;
  createdAt: string;
};

type LinhaAvaliacao = {
  id: string;
  aluno_id: string;
  nota: number;
  comentario: string | null;
  created_at: string;
};

// Lista paginada das avaliações individuais de UMA aula — usada pelo dialog "Ver detalhes"
// (src/components/admin/avaliacao-detalhes-dialog.tsx). Paginação client-driven (onNavigate do
// componente Paginacao, não searchParams de URL — mesmo padrão de financeiro/avulsos), por isso é
// uma Server Action e não faz parte do carregamento da página principal.
export async function listarAvaliacoesDaAula(
  aulaId: string,
  pagina: string | undefined,
  limite: string | undefined,
): Promise<{ itens: AvaliacaoIndividualView[]; total: number; erro?: string }> {
  await requireRole("admin");

  const p = parsePagina(pagina);
  const l = parseLimite(limite);
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("aula_avaliacoes")
    .select("id, aluno_id, nota, comentario, created_at", { count: "exact" })
    .eq("aula_id", aulaId)
    .order("created_at", { ascending: false })
    .range(calcularOffset(p, l), calcularOffset(p, l) + l - 1);

  if (error) {
    return { itens: [], total: 0, erro: "Não foi possível carregar as avaliações desta aula." };
  }

  const linhas = (data ?? []) as LinhaAvaliacao[];
  const alunoIds = Array.from(new Set(linhas.map((linha) => linha.aluno_id)));
  const nomes = new Map<string, string>();
  if (alunoIds.length > 0) {
    const { data: perfis } = await supabase.from("profiles").select("id, full_name").in("id", alunoIds);
    for (const perfil of (perfis ?? []) as { id: string; full_name: string | null }[]) {
      nomes.set(perfil.id, perfil.full_name?.trim() || "Aluno");
    }
  }

  return {
    itens: linhas.map((linha) => ({
      id: linha.id,
      // Abreviado mesmo pro admin — pedido explícito da tarefa (diferente do restante do
      // painel, onde o admin normalmente vê o nome completo do aluno).
      alunoNome: nomeAbreviado(nomes.get(linha.aluno_id) ?? "Aluno"),
      nota: linha.nota,
      comentario: linha.comentario,
      createdAt: linha.created_at,
    })),
    total: count ?? 0,
  };
}
