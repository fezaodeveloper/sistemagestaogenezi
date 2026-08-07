"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const PDF_SIGNED_URL_EXPIRES_IN = 600; // 10 minutos

// Gerada sob demanda (só quando o aluno clica em "ver material"), não no
// carregamento da página — evita assinar links que talvez nunca sejam
// abertos. RLS de `materiais` já restringe a busca a alunos matriculados no
// curso dono do material; RLS de `storage.objects` protege de novo na hora
// de assinar (defesa em profundidade, mesmo padrão já usado no resto do
// projeto).
export async function getPdfSignedUrl(
  materialId: string,
): Promise<{ url: string } | { error: string }> {
  await requireRole("aluno");

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materiais")
    .select("url")
    .eq("id", materialId)
    .eq("tipo", "pdf")
    .single();

  if (!material) {
    return { error: "Material não encontrado." };
  }

  const { data: signed, error } = await supabase.storage
    .from("materiais")
    .createSignedUrl(material.url, PDF_SIGNED_URL_EXPIRES_IN);

  if (error || !signed) {
    return { error: "Não foi possível carregar este material." };
  }

  return { url: signed.signedUrl };
}
