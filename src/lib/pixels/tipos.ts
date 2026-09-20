// Tipos de pixel suportados. Sem dependência de servidor — a tela (client), a
// validação (server) e a injeção nas páginas públicas usam a mesma lista.

export const PIXEL_TIPOS = ["meta_ads", "tiktok_ads", "google_ads", "google_analytics", "script_personalizado"] as const;

export type PixelTipo = (typeof PIXEL_TIPOS)[number];

export const PIXEL_TIPO_LABELS: Record<PixelTipo, string> = {
  meta_ads: "Meta Ads (Facebook Pixel)",
  tiktok_ads: "TikTok Ads",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics (GA4)",
  script_personalizado: "Script personalizado",
};

export const PIXEL_TIPO_CURTOS: Record<PixelTipo, string> = {
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  google_ads: "Google Ads",
  google_analytics: "GA4",
  script_personalizado: "Personalizado",
};

export const PIXEL_TIPO_DICAS: Record<PixelTipo, string> = {
  meta_ads: "Cole o código base do Pixel (o bloco <script> do Gerenciador de Eventos).",
  tiktok_ads: "Cole o código base do TikTok Pixel (Events Manager).",
  google_ads: "Cole a tag do Google Ads (gtag). Para contar conversões, inclua o trecho com send_to \"AW-XXXX/rótulo\".",
  google_analytics: "Cole a tag do Google Analytics 4 (gtag.js com o ID G-XXXXXXX).",
  script_personalizado: "Qualquer código HTML/JavaScript. Ele roda como colado; os eventos padrão não são disparados por ele.",
};

export function isPixelTipo(valor: unknown): valor is PixelTipo {
  return typeof valor === "string" && (PIXEL_TIPOS as readonly string[]).includes(valor);
}

// Cada plataforma tem uma "assinatura" reconhecível no código que fornece. Só um
// alerta contra colar o código no tipo errado — "script personalizado" aceita tudo.
const ASSINATURAS: Record<Exclude<PixelTipo, "script_personalizado">, RegExp> = {
  meta_ads: /fbq|facebook/i,
  tiktok_ads: /ttq|tiktok/i,
  google_ads: /gtag|googletagmanager|AW-\d/i,
  google_analytics: /gtag|googletagmanager|G-[A-Z0-9]/i,
};

export const PIXEL_SCRIPT_MAXIMO = 50_000;

export function validarScriptPixel(tipo: PixelTipo, script: string): { ok: true } | { ok: false; erro: string } {
  const texto = script.trim();
  if (!texto) return { ok: false, erro: "Cole o código do pixel." };
  if (texto.length > PIXEL_SCRIPT_MAXIMO) return { ok: false, erro: "O código é longo demais." };
  if (tipo !== "script_personalizado" && !ASSINATURAS[tipo].test(texto)) {
    return { ok: false, erro: `Este código não parece ser de ${PIXEL_TIPO_LABELS[tipo]}. Confira o tipo escolhido.` };
  }
  return { ok: true };
}
