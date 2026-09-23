// Extrai o ID do vídeo a partir dos formatos de URL que o YouTube aceita (watch, youtu.be,
// embed, shorts) — retorna null pra URL malformada/desconhecida em vez de lançar, a tela trata
// isso como "vídeo indisponível". Vídeo "não listado" funciona igual: não existe um formato de
// URL próprio pra não listado, é a mesma URL de um vídeo público (só não aparece em busca).
export function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Sem protocolo (ex.: "youtube.com/watch?v=..." colado sem "https://") — tenta de novo com
    // https:// na frente antes de desistir.
    try {
      parsed = new URL(`https://${url}`);
    } catch {
      return null;
    }
  }

  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id || null;
  }

  if (host === "youtube.com") {
    const watchId = parsed.searchParams.get("v");
    if (watchId) return watchId;

    const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
    if (match) return match[1];
  }

  return null;
}
