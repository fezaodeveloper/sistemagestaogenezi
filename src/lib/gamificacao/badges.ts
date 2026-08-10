import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type BadgeCatalogo = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  ordem: number;
};

export type BadgeConquistado = { badgeId: string; conquistadoEm: string };

// Catálogo completo (fixo, cabe inteiro em qualquer tela) — usado tanto
// pra listar "conquistados" quanto "ainda não conquistados" no perfil.
export async function getCatalogoBadges(supabase: SupabaseServerClient): Promise<BadgeCatalogo[]> {
  const { data } = await supabase
    .from("badges")
    .select("id, nome, descricao, icone, ordem")
    .order("ordem");

  return (data ?? []) as BadgeCatalogo[];
}

export async function getMeusBadges(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<BadgeConquistado[]> {
  const { data } = await supabase
    .from("badges_conquistados")
    .select("badge_id, conquistado_em")
    .eq("aluno_id", alunoId);

  return (data ?? []).map((row) => ({
    badgeId: row.badge_id as string,
    conquistadoEm: row.conquistado_em as string,
  }));
}

// Pra exibir os ícones de badge ao lado de cada aluno no ranking — uma
// única query buscando os badges de todos os alunos exibidos, agrupada
// em memória (mesmo padrão de agrupamento já usado em agruparPorCurso).
export async function getBadgesPublicosPorAluno(
  supabase: SupabaseServerClient,
  alunoIds: string[],
): Promise<Map<string, { icone: string; nome: string }[]>> {
  const mapa = new Map<string, { icone: string; nome: string }[]>();
  if (alunoIds.length === 0) return mapa;

  const { data } = await supabase
    .from("badges_publicos")
    .select("aluno_id, icone, nome, ordem")
    .in("aluno_id", alunoIds)
    .order("ordem");

  for (const row of data ?? []) {
    const alunoId = row.aluno_id as string;
    const lista = mapa.get(alunoId) ?? [];
    lista.push({ icone: row.icone as string, nome: row.nome as string });
    mapa.set(alunoId, lista);
  }

  return mapa;
}
