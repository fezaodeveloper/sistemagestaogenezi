import type { PixelTipo } from "@/lib/pixels/tipos";

// Analisa o código colado pelo admin. Funções puras (sem servidor): quem injeta as
// partes é src/components/pixels/pixels-scripts.tsx.
//
// Por que separar em partes e não jogar o HTML inteiro num dangerouslySetInnerHTML:
// <script> inserido por innerHTML NÃO executa (nem na hidratação, nem em navegação
// client-side). Cada parte vai pro <Script> do next/script, que executa nos dois casos.

export type ParteScript =
  | { tipo: "inline"; codigo: string }
  | { tipo: "externo"; src: string };

export type ScriptAnalisado = {
  partes: ParteScript[];
  // Conteúdo interno dos <noscript> (ex.: o <img> de fallback do Meta Pixel).
  noscripts: string[];
};

function srcSeguro(bruto: string): string | null {
  const src = bruto.trim();
  if (src.startsWith("//")) return `https:${src}`;
  return src.startsWith("https://") ? src : null;
}

export function analisarScript(bruto: string): ScriptAnalisado {
  let texto = bruto.replace(/<!--[\s\S]*?-->/g, "");

  const noscripts: string[] = [];
  texto = texto.replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, (_todo, interno: string) => {
    // Nunca deixa um <script> entrar pelo noscript.
    const limpo = interno.replace(/<script\b[\s\S]*?<\/script>/gi, "").trim();
    if (limpo) noscripts.push(limpo);
    return "";
  });

  const partes: ParteScript[] = [];
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let achouTag = false;
  for (let m = regex.exec(texto); m !== null; m = regex.exec(texto)) {
    achouTag = true;
    const atributos = m[1];
    const corpo = m[2].trim();
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(atributos);
    if (src) {
      const seguro = srcSeguro(src[1] ?? src[2] ?? src[3] ?? "");
      if (seguro) partes.push({ tipo: "externo", src: seguro });
    } else if (corpo) {
      partes.push({ tipo: "inline", codigo: corpo });
    }
  }

  // Sem nenhuma tag <script> e sem começar por "<" (HTML): é JavaScript puro colado
  // sem as tags.
  if (!achouTag && texto.trim() && !texto.trimStart().startsWith("<")) {
    partes.push({ tipo: "inline", codigo: texto.trim() });
  }

  return { partes, noscripts };
}

// O código-base de cada plataforma já dispara o "page view" sozinho. Disparar de novo
// contaria a visita em dobro — então o evento manual só sai quando o código colado
// NÃO faz isso.
export function scriptJaDisparaPageView(tipo: PixelTipo, script: string): boolean {
  switch (tipo) {
    case "meta_ads":
      return /fbq\s*\(\s*['"]track['"]\s*,\s*['"]PageView['"]/i.test(script);
    case "tiktok_ads":
      return /ttq\s*\.\s*page\s*\(/i.test(script);
    case "google_analytics":
      // gtag('config', 'G-...') envia page_view automaticamente.
      return /gtag\s*\(\s*['"]config['"]/i.test(script);
    case "google_ads":
    case "script_personalizado":
      return false;
  }
}

// Google Ads: destino do evento ("AW-123456789/rótulo" da conversão, ou só o ID
// "AW-123456789" da tag).
export function extrairSendToGoogleAds(script: string): string | null {
  const conversao = /send_to['"]?\s*:\s*['"](AW-[\w-]+\/[\w-]+)['"]/i.exec(script);
  if (conversao) return conversao[1];
  const config = /gtag\s*\(\s*['"]config['"]\s*,\s*['"](AW-[\w-]+)['"]/i.exec(script);
  if (config) return config[1];
  const qualquer = /['"](AW-\d+)['"]/i.exec(script);
  return qualquer ? qualquer[1] : null;
}
