import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ConquistaDesbloqueada = {
  id: string;
  titulo: string;
  descricao: string | null;
  badge_url: string | null;
  badge_emoji: string | null;
};

// Chama verificar_conquistas_personalizadas(p_aluno_id) — a função nova; NÃO confundir com a
// verificar_conquistas_aluno original, que concede as medalhas fixas e segue intacta.
//
// Sempre com o client admin: quem chama nem sempre é o próprio aluno (o admin aprovando um
// comentário, a emissão de certificado). É idempotente e devolve só o que foi desbloqueado
// AGORA. Best-effort: NUNCA lança pro chamador — uma falha aqui (migration pendente, banco
// indisponível) não pode atrapalhar concluir aula, aprovar comentário ou emitir certificado.
export async function verificarConquistasPersonalizadas(alunoId: string): Promise<ConquistaDesbloqueada[]> {
  try {
    const { data, error } = await createAdminClient().rpc("verificar_conquistas_personalizadas", {
      p_aluno_id: alunoId,
    });
    if (error) return [];
    return (data ?? []) as ConquistaDesbloqueada[];
  } catch {
    return [];
  }
}
