"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TERMO_LEGAL_CHAVES, type TermoLegalChave } from "@/lib/termos-legais/schema";

// UPDATE, não upsert de verdade: as 4 linhas (uma por chave) já existem
// desde a seed da migration (supabase/migrations/20260917600000_termos_legais.sql)
// — não há cenário em que a linha não exista ainda, e "authenticated" só
// tem GRANT de update nessa tabela (ver a migration), não de insert.
export async function salvarTermoLegal(
  chave: TermoLegalChave,
  conteudo: string,
): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  if (!(TERMO_LEGAL_CHAVES as readonly string[]).includes(chave)) {
    return { error: "Documento inválido." };
  }

  const supabase = await createClient();
  // .select("chave") pra saber quantas linhas o UPDATE atingiu: um update
  // bloqueado por RLS/grant não devolve erro, só afeta 0 linhas — sem isto o
  // editor mostraria "Salvo" sem ter salvado nada.
  const { data, error } = await supabase
    .from("termos_legais")
    .update({
      conteudo,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user.id,
    })
    .eq("chave", chave)
    .select("chave");

  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath(`/admin/legal/${chave}`);
  revalidatePath(`/aluno/legal/${chave}`);
  return {};
}
