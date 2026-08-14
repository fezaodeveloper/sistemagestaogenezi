"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getContagemConversasNaoLidasAdmin, getContagemNaoLidasAluno } from "./chat";

// Server Actions dedicadas só a alimentar o refetch do badge ao vivo da
// sidebar (BadgeChatNaoLidas) — chamadas do client a cada evento de
// Realtime relevante, nunca no primeiro carregamento (esse já vem via
// props, calculado no layout Server Component).
export async function getContagemNaoLidasAdminAction(): Promise<number> {
  await requireRole("admin");
  const supabase = await createClient();
  return getContagemConversasNaoLidasAdmin(supabase);
}

export async function getContagemNaoLidasAlunoAction(conversaId: string): Promise<number> {
  const user = await requireRole("aluno");
  const supabase = await createClient();
  return getContagemNaoLidasAluno(supabase, conversaId, user.id);
}
