import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const TIPOS_SUPORTADOS = ["image/png", "image/jpeg"];
const CACHE_MS = 5 * 60 * 1000;

let cache: { url: string; dataUri: string | null; em: number } | null = null;

// Logo da escola (configuracoes.escola_logo_url) pronto pra ir num PDF do
// @react-pdf/renderer, como data URI (base64).
//
// Por que data URI em vez de repassar a URL: (1) o @react-pdf só desenha PNG
// e JPEG — logo em SVG/WebP (que o upload da escola aceita) faria a geração
// do PDF inteiro lançar erro; aqui esses formatos viram `null` e o PDF sai
// sem logo em vez de quebrar. (2) PDFs gerados no navegador não dependem de
// CORS do Storage pra baixar a imagem.
//
// O campo chama `escola_logo_url` (não `logo_url`) — já existe desde a tela de
// login, não precisou de migration.
export async function carregarLogoEscolaParaPdf(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("configuracoes").select("escola_logo_url").eq("id", true).maybeSingle();
  const url = (data?.escola_logo_url as string | null | undefined) ?? null;
  if (!url) return null;

  if (cache && cache.url === url && Date.now() - cache.em < CACHE_MS) return cache.dataUri;

  let dataUri: string | null = null;
  try {
    const resposta = await fetch(url);
    const tipo = (resposta.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (resposta.ok && TIPOS_SUPORTADOS.includes(tipo)) {
      const bytes = Buffer.from(await resposta.arrayBuffer());
      dataUri = `data:${tipo};base64,${bytes.toString("base64")}`;
    }
  } catch {
    // Storage fora do ar / URL inválida — PDF sai sem logo.
  }

  cache = { url, dataUri, em: Date.now() };
  return dataUri;
}
