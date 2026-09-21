"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getConquistasAtivo } from "@/lib/conquistas/config";
import { verificarConquistasPersonalizadas } from "@/lib/conquistas/verificar";
import type { ConquistaNovaView } from "@/lib/conquistas/tipos";

type LinhaNova = {
  id: string;
  conquistas: { titulo: string; descricao: string | null; badge_url: string | null; badge_emoji: string | null } | null;
};

// Chamada pelo provider do layout do aluno (ao carregar e a cada navegação): dispara a
// verificação (desbloqueia o que o aluno já mereceria — inclusive conquistas criadas depois) e
// devolve as que ele AINDA NÃO VIU no modal de celebração. Nunca lança.
export async function buscarConquistasNovas(): Promise<ConquistaNovaView[]> {
  const user = await requireRole("aluno");

  try {
    const supabase = await createClient();
    if (!(await getConquistasAtivo(supabase))) return [];

    await verificarConquistasPersonalizadas(user.id);

    const { data, error } = await supabase
      .from("aluno_conquistas")
      .select("id, conquistas(titulo, descricao, badge_url, badge_emoji)")
      .eq("aluno_id", user.id)
      .is("notificada_em", null)
      .order("desbloqueada_em", { ascending: true })
      .limit(20);
    if (error) return [];

    return ((data ?? []) as unknown as LinhaNova[])
      .filter((linha): linha is LinhaNova & { conquistas: NonNullable<LinhaNova["conquistas"]> } => !!linha.conquistas)
      .map((linha) => ({
        desbloqueioId: linha.id,
        titulo: linha.conquistas.titulo,
        descricao: linha.conquistas.descricao,
        badgeUrl: linha.conquistas.badge_url,
        badgeEmoji: linha.conquistas.badge_emoji,
      }));
  } catch {
    return [];
  }
}

// O aluno viu o modal: marca no banco (não repete em outro aparelho). A RLS/grant só permite
// mexer em notificada_em das próprias linhas.
export async function marcarConquistasVistas(desbloqueioIds: string[]): Promise<void> {
  const user = await requireRole("aluno");

  const ids = z.array(z.uuid()).max(50).safeParse(desbloqueioIds);
  if (!ids.success || ids.data.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("aluno_conquistas")
    .update({ notificada_em: new Date().toISOString() })
    .eq("aluno_id", user.id)
    .in("id", ids.data)
    .is("notificada_em", null);
}
