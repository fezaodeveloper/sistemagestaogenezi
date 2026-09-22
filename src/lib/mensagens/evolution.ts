import "server-only";

export type EnvioWhatsappResultado = { ok: true } | { ok: false; erro: string };

// Timeout da chamada HTTP — precisa ficar com folga ABAIXO do maxDuration da rota que chama esta
// function (30s em /admin/configuracoes/whatsapp, ver page.tsx). Sem isso, um fetch que trava
// (VPS fora do ar, proxy engasgado) só terminaria quando a Vercel matar a function por estourar o
// tempo máximo — e uma function morta pela PLATAFORMA devolve uma resposta que não é um payload
// de Server Action válido, o que o Next não consegue interpretar e mostra pro usuário como "An
// unexpected response was received from the server" (em vez do erro de verdade). Com o timeout
// aqui, o fetch sempre falha de um jeito que o try/catch abaixo consegue capturar e devolver
// como {ok:false, erro} normal, bem antes do limite da function.
const TIMEOUT_MS = 20_000;

// Primeiros 8 caracteres da apikey, só pra log de diagnóstico — nunca a chave inteira.
function apikeyParcial(apiKey: string): string {
  return apiKey ? `${apiKey.slice(0, 8)}…` : "(vazia)";
}

// Formato de request da Evolution API (POST /message/sendText/{instance},
// header apikey) — isolado nesta única function pra qualquer ajuste de
// versão/payload da API não vazar pro resto do código.
export async function enviarWhatsapp(
  config: { url: string; instancia: string; apiKey: string },
  numero: string,
  texto: string,
): Promise<EnvioWhatsappResultado> {
  const endpoint = `${config.url.replace(/\/$/, "")}/message/sendText/${config.instancia}`;
  const headers = { "Content-Type": "application/json", apikey: config.apiKey };
  const body = { number: numero, text: texto };

  // Log ANTES do fetch (aparece nos logs do Vercel mesmo se a chamada nunca voltar) — mostra
  // exatamente o que foi enviado à Evolution API, sem a apikey inteira.
  console.log("[whatsapp:evolution] POST sendText", {
    endpoint,
    headers: { ...headers, apikey: apikeyParcial(config.apiKey) },
    body,
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Checa response.ok ANTES de tentar interpretar o corpo — um 502/503/504 costuma vir como
    // página HTML (do proxy na frente da Evolution API, não da Evolution em si), nunca JSON.
    // Por isso o corpo de erro é sempre lido como TEXTO (nunca response.json()), tanto aqui
    // quanto no restante deste arquivo — um JSON.parse num HTML lançaria um SyntaxError que,
    // sem esse cuidado, escaparia pro Next como exceção não tratada.
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
    const mensagemErro = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && /timeout|aborted/i.test(err.name + mensagemErro)) {
      return { ok: false, erro: "A Evolution API não respondeu a tempo. Confira se a URL está correta e a VPS está no ar." };
    }
    // Nunca deixa passar um valor que não seja string — cobre até o caso raro de algo lançar
    // algo que não é um Error de verdade.
    return { ok: false, erro: mensagemErro || "Falha de rede ao chamar a Evolution API." };
  }
}
