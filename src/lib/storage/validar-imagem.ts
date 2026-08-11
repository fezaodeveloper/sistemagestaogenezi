import { randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const TIPOS_IMAGEM_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO_PADRAO = 5 * 1024 * 1024; // 5MB

// Compartilhado entre cursos/premios/módulos — antes cada action tinha
// sua própria cópia (a de prêmios nem validava tipo/tamanho de fato, só
// checava se era um File não vazio). Não valida proporção — quem exibe
// a imagem sempre recorta via CSS (object-cover) no aspect-ratio certo,
// então uma imagem "quase" no formato ainda fica com aparência
// consistente; a prévia no formulário já mostra o recorte real.
export function validarImagem(
  entry: FormDataEntryValue | null,
  maxBytes: number = TAMANHO_MAXIMO_PADRAO,
): { erro?: string; arquivo?: File } {
  if (!(entry instanceof File) || entry.size === 0) {
    return {};
  }
  if (!TIPOS_IMAGEM_ACEITOS.includes(entry.type)) {
    return { erro: "O arquivo precisa ser uma imagem (JPEG, PNG ou WebP)." };
  }
  if (entry.size > maxBytes) {
    return { erro: `A imagem pode ter no máximo ${Math.round(maxBytes / (1024 * 1024))}MB.` };
  }
  return { arquivo: entry };
}

export async function uploadImagem(
  supabase: SupabaseServerClient,
  bucket: string,
  arquivo: File,
): Promise<{ path: string | null; error: unknown }> {
  const extensao = arquivo.name.split(".").pop() || "jpg";
  const path = `${randomUUID()}.${extensao}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arquivo, { contentType: arquivo.type });
  return { path: error ? null : path, error };
}
