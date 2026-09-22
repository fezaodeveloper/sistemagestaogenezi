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
      // Log completo pros logs do Vercel — a tela só mostra uma versão curta do erro (abaixo).
      // apikey nunca entra no log (nem mascarada): não é preciso pra diagnosticar, e vaza no
      // console em texto puro se entrar.
      console.error("[whatsapp:evolution] sendText falhou", {
        endpoint,
        instancia: config.instancia,
        status: response.status,
        statusText: response.statusText,
        corpo: corpo.slice(0, 1000),
      });
      return {
        ok: false,
        erro: `Evolution API respondeu ${response.status}${corpo ? `: ${corpo.slice(0, 300)}` : ""}`,
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[whatsapp:evolution] sendText — falha de rede/exceção", {
      endpoint,
      instancia: config.instancia,
      erro: err instanceof Error ? { nome: err.name, mensagem: err.message } : err,
    });
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha de rede ao chamar a Evolution API.",
    };
  }
}
