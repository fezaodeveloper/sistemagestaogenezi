import "server-only";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "GÊNEZI Educação <no-reply@sistemagestaogenezi.com.br>";

export function resendConfigurado(): boolean {
  return Boolean(RESEND_API_KEY);
}

// Mesmo padrão de enviarMensagemTelegram (src/lib/telegram/client.ts):
// best-effort, nunca lança — falha de rede, token ausente ou erro da API
// só retorna false. REGRA: só chama a API se RESEND_API_KEY estiver
// configurado (ver resendConfigurado, checada antes por quem chama).
export async function enviarEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
