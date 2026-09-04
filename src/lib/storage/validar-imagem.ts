import { randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const TIPOS_IMAGEM_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
// Certificado precisa ser embutido num PDF via pdf-lib, que só sabe ler
// JPEG e PNG (sem suporte a WebP) — por isso o upload de fundo/logo do
// template usa esse subconjunto em vez do padrão.
export const TIPOS_IMAGEM_ACEITOS_PDF = ["image/jpeg", "image/png"];
const TAMANHO_MAXIMO_PADRAO = 5 * 1024 * 1024; // 5MB

const LABEL_POR_TIPO: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

// Compartilhado entre cursos/premios/módulos — antes cada action tinha
// sua própria cópia (a de prêmios nem validava tipo/tamanho de fato, só
// checava se era um File não vazio). Não valida proporção — quem exibe
// a imagem sempre recorta via CSS (object-cover) no aspect-ratio certo,
// então uma imagem "quase" no formato ainda fica com aparência
// consistente; a prévia no formulário já mostra o recorte real.
export function validarImagem(
  entry: FormDataEntryValue | null,
  maxBytes: number = TAMANHO_MAXIMO_PADRAO,
  tiposAceitos: string[] = TIPOS_IMAGEM_ACEITOS,
): { erro?: string; arquivo?: File } {
  if (!(entry instanceof File) || entry.size === 0) {
    return {};
  }
  if (!tiposAceitos.includes(entry.type)) {
    const labels = tiposAceitos.map((tipo) => LABEL_POR_TIPO[tipo] ?? tipo).join(", ");
    return { erro: `O arquivo precisa ser uma imagem (${labels}).` };
  }
  if (entry.size > maxBytes) {
    return { erro: `A imagem pode ter no máximo ${Math.round(maxBytes / (1024 * 1024))}MB.` };
  }
  return { arquivo: entry };
}

export const TIPOS_ARQUIVO_DIGITAL_ACEITOS = ["application/pdf", "application/zip", "application/x-zip-compressed"];
const TAMANHO_MAXIMO_ARQUIVO_DIGITAL = 20 * 1024 * 1024; // 20MB

// Arquivo de entrega digital de prêmio (TAREFA 11B) — PDF ou ZIP, maior
// que o limite de imagem porque pode ser um material mais robusto (ebook,
// pacote de arquivos). uploadImagem() abaixo é genérico o bastante
// (só faz upload de um File pro bucket) pra ser reaproveitado aqui apesar
// do nome.
export function validarArquivoDigital(entry: FormDataEntryValue | null): { erro?: string; arquivo?: File } {
  if (!(entry instanceof File) || entry.size === 0) {
    return {};
  }
  if (!TIPOS_ARQUIVO_DIGITAL_ACEITOS.includes(entry.type)) {
    return { erro: "O arquivo de entrega precisa ser PDF ou ZIP." };
  }
  if (entry.size > TAMANHO_MAXIMO_ARQUIVO_DIGITAL) {
    return { erro: "O arquivo de entrega pode ter no máximo 20MB." };
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
