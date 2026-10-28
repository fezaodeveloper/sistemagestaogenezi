import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// Tira as tags do HTML salvo pelo editor Tiptap — usado só pro texto do checkbox de
// acompanhamento (conecta_menor_termo), que precisa ficar dentro de um <Label> de uma linha,
// não de um bloco com dangerouslySetInnerHTML como as páginas legais inteiras.
export function textoPlanoDoTermo(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mesma leitura, mas via service_role — pra contextos SEM sessão (fluxo público de assinatura
// do termo de imagem por CPF, src/app/termo-imagem/[matriculaId]/). getTermoLegal() usa
// createClient() normal, que exige role "authenticated" (o grant de select em termos_legais só
// cobre esse role — ver 20260917600000_termos_legais.sql); aqui não há sessão nenhuma, então
// esse client sempre bateria em "permission denied".
export async function getTermoLegalPublico(chave: TermoLegalChave): Promise<TermoLegal | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("termos_legais")
    .select("id, chave, titulo, conteudo, atualizado_em, atualizado_por")
    .eq("chave", chave)
    .maybeSingle();

  return data as TermoLegal | null;
}
