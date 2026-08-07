// Extrai o ID do vídeo a partir dos formatos de URL que o YouTube aceita
// (watch, youtu.be, embed) — retorna null pra URL malformada/desconhecida
// em vez de lançar, a tela trata isso como "vídeo indisponível".
export function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id || null;
  }

  if (host === "youtube.com") {
    const watchId = parsed.searchParams.get("v");
    if (watchId) return watchId;

    const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return embedMatch[1];
  }

  return null;
}
