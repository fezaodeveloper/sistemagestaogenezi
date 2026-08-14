"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const PDF_SIGNED_URL_EXPIRES_IN = 600; // 10 minutos — mesmo valor da versão do aluno.

// Variante admin de getPdfSignedUrl (src/app/aluno/.../actions.ts), que é
// hardcoded pra requireRole("aluno"). RLS de materiais/storage.objects já
// dá ao admin select amplo, então essa function só precisa checar o papel
// e assinar a URL.
export async function getPdfSignedUrlAdmin(
  materialId: string,
): Promise<{ url: string } | { error: string }> {
  await requireRole("admin");

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
