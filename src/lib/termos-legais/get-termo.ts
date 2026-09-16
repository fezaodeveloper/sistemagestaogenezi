import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TermoLegal, TermoLegalChave } from "@/lib/termos-legais/schema";

export async function getTermoLegal(chave: TermoLegalChave): Promise<TermoLegal | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("termos_legais")
    .select("id, chave, titulo, conteudo, atualizado_em, atualizado_por")
    .eq("chave", chave)
    .maybeSingle();

  return data as TermoLegal | null;
}
