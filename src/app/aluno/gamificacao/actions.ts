"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type NovaMedalha = {
  badgeId: string;
  conquistadoEm: string;
  nome: string;
  descricao: string;
  icone: string;
};

type BadgeConquistadoRow = {
  badge_id: string;
  conquistado_em: string;
  badges: { nome: string; descricao: string; icone: string } | null;
};

// Badges conquistados nas últimas 24h — usado por useConquistas pra decidir
// se mostra o ConquistaModal ao aluno.
export async function getNovasMedalhas(alunoId: string): Promise<NovaMedalha[]> {
  const user = await requireRole("aluno");
  if (user.id !== alunoId) return [];

  const supabase = await createClient();
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("badges_conquistados")
    .select("badge_id, conquistado_em, badges(nome, descricao, icone)")
    .eq("aluno_id", alunoId)
    .gte("conquistado_em", desde)
    .order("conquistado_em", { ascending: false });

  return ((data ?? []) as unknown as BadgeConquistadoRow[])
    .filter((row): row is BadgeConquistadoRow & { badges: NonNullable<BadgeConquistadoRow["badges"]> } =>
      Boolean(row.badges),
    )
    .map((row) => ({
      badgeId: row.badge_id,
      conquistadoEm: row.conquistado_em,
      nome: row.badges.nome,
      descricao: row.badges.descricao,
      icone: row.badges.icone,
    }));
}
