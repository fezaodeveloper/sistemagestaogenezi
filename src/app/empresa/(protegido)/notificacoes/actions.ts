"use server";

import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Sem checagem manual de "essa notificação é da minha empresa" — a policy
// "Empresa marca como lida" (RLS) já escopa o UPDATE pela própria empresa;
// um id de outra empresa simplesmente não afeta nenhuma linha.
export async function marcarNotificacaoLida(id: string): Promise<{ error?: string }> {
  await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes_empresa").update({ lida: true }).eq("id", id);

  if (error) {
    return { error: "Não foi possível marcar como lida. Tente novamente." };
  }

  revalidatePath("/empresa/notificacoes");
  // type "layout" invalida o cache de toda a árvore sob /empresa (não só
  // /empresa/notificacoes) — sem isso o badge de não lidas na sidebar
  // (renderizado pelo layout) só atualizaria ao visitar um path nunca
  // cacheado (Partial Rendering do Next não re-executa layout entre
  // navegações client-side de rotas irmãs, ver CLAUDE.md).
  revalidatePath("/empresa", "layout");
  return {};
}
