import "server-only";

import { emailConfigurado, enviarEmail as enviarEmailUnificado } from "@/lib/email/provedor";

// Camada de COMPATIBILIDADE: o envio real mora em src/lib/email/provedor.ts, que lê o
// provedor escolhido em /admin/configuracoes/email (Resend, SMTP ou SendGrid). Sem
// nenhuma configuração salva, continua sendo exatamente o Resend do ambiente
// (RESEND_API_KEY / RESEND_FROM_EMAIL) — mesma chamada de sempre. Quem já importa
// daqui não precisou mudar.

// @deprecated Só olha a variável de ambiente. Prefira emailConfigurado() (async), que
// considera o provedor escolhido na tela de configuração.
export function resendConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export { emailConfigurado };

// Best-effort: nunca lança — falha de rede, chave ausente ou erro do provedor só
// retorna false.
export async function enviarEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const resultado = await enviarEmailUnificado({ para: params.to, assunto: params.subject, html: params.html });
  return resultado.ok;
}
