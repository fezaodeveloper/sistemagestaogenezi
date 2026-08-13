import "server-only";

export type EnvioWhatsappResultado = { ok: true } | { ok: false; erro: string };

// Formato de request da Evolution API (POST /message/sendText/{instance},
// header apikey) — isolado nesta única function pra qualquer ajuste de
// versão/payload da API não vazar pro resto do código.
export async function enviarWhatsapp(
  config: { url: string; instancia: string; apiKey: string },
  numero: string,
  texto: string,
): Promise<EnvioWhatsappResultado> {
  const endpoint = `${config.url.replace(/\/$/, "")}/message/sendText/${config.instancia}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: JSON.stringify({ number: numero, text: texto }),
    });

    if (!response.ok) {
      const corpo = await response.text().catch(() => "");
      return {
        ok: false,
        erro: `Evolution API respondeu ${response.status}${corpo ? `: ${corpo.slice(0, 300)}` : ""}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha de rede ao chamar a Evolution API.",
    };
  }
}
