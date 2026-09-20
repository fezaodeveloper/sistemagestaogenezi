import "server-only";

import nodemailer from "nodemailer";
import { carregarConfigEmail, type ConfigEmail, type ProvedorEmail } from "@/lib/email/config";
import { htmlParaTexto } from "@/lib/email/renderizar";
import { validarUrlWebhook } from "@/lib/webhooks/eventos";

// Envio de e-mail unificado: Resend, SMTP (nodemailer) ou SendGrid, conforme o
// provedor escolhido em /admin/configuracoes/email. NUNCA lança — devolve { ok, erro? }
// — então um e-mail que falha jamais derruba o fluxo que o chamou.
//
// COMPATIBILIDADE COM O RESEND EXISTENTE: sem configuração no banco (linha ausente,
// tabela ainda inexistente, ou provedor "resend" sem chave salva), o envio usa
// RESEND_API_KEY / RESEND_FROM_EMAIL do ambiente e a MESMA chamada à API que
// src/lib/resend/client.ts sempre fez.

const RESEND_URL = "https://api.resend.com/emails";
const REMETENTE_PADRAO_RESEND = "GÊNEZI Educação <no-reply@sistemagestaogenezi.com.br>";
const TIMEOUT_MS = 20_000;

export type EmailParams = {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  // Cabeçalhos extras (ex.: List-Unsubscribe nos e-mails de marketing).
  headers?: Record<string, string>;
};
export type ResultadoEmail = { ok: boolean; erro?: string };
export type ResultadoTesteProvedor = { ok: boolean; erro?: string; aviso?: string };

function remetente(nome: string, email: string): string {
  return nome ? `${nome.replace(/["<>]/g, "")} <${email}>` : email;
}

function mensagemErro(erro: unknown, padrao: string): string {
  const mensagem = erro instanceof Error ? erro.message : "";
  return /timeout|timed out|aborted/i.test(mensagem) ? "O servidor não respondeu a tempo." : mensagem || padrao;
}

// ===== Resend =====

function resolverResend(config: ConfigEmail | null): { apiKey: string; from: string } {
  const r = config?.resend;
  return {
    apiKey: r?.apiKey || process.env.RESEND_API_KEY || "",
    from: r?.fromEmail ? remetente(r.fromName, r.fromEmail) : (process.env.RESEND_FROM_EMAIL ?? REMETENTE_PADRAO_RESEND),
  };
}

async function enviarPorResend(config: ConfigEmail | null, params: EmailParams): Promise<ResultadoEmail> {
  const { apiKey, from } = resolverResend(config);
  if (!apiKey) return { ok: false, erro: "Resend sem API Key (nem salva na tela, nem em RESEND_API_KEY)." };

  const resposta = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: params.para,
      subject: params.assunto,
      html: params.html,
      ...(params.texto ? { text: params.texto } : {}),
      ...(params.headers ? { headers: params.headers } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (resposta.ok) return { ok: true };
  const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, erro: `Resend: ${corpo?.message ?? `erro ${resposta.status}`}` };
}

// ===== SMTP =====

function criarTransporte(smtp: ConfigEmail["smtp"]) {
  // Porta 465 = TLS implícito; outras (587/25) usam STARTTLS quando "SSL/TLS" está ligado.
  const secure = smtp.ssl && smtp.porta === 465;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure,
    requireTLS: smtp.ssl && !secure,
    auth: smtp.usuario ? { user: smtp.usuario, pass: smtp.senha } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function validarSmtp(smtp: ConfigEmail["smtp"]): string | null {
  if (!smtp.host) return "Informe o servidor SMTP (host).";
  // Mesma proteção dos webhooks: o servidor não pode ser usado pra alcançar a rede interna.
  const host = validarUrlWebhook(`https://${smtp.host}`);
  if (!host.ok) return "O host SMTP não pode ser um endereço interno ou local.";
  if (!smtp.fromEmail) return "Informe o e-mail do remetente (from).";
  return null;
}

async function enviarPorSmtp(config: ConfigEmail, params: EmailParams): Promise<ResultadoEmail> {
  const invalido = validarSmtp(config.smtp);
  if (invalido) return { ok: false, erro: invalido };

  await criarTransporte(config.smtp).sendMail({
    from: remetente(config.smtp.fromName, config.smtp.fromEmail),
    to: params.para,
    subject: params.assunto,
    html: params.html,
    text: params.texto ?? htmlParaTexto(params.html),
    ...(params.headers ? { headers: params.headers } : {}),
  });
  return { ok: true };
}

// ===== SendGrid =====

async function enviarPorSendGrid(config: ConfigEmail, params: EmailParams): Promise<ResultadoEmail> {
  const sg = config.sendgrid;
  if (!sg.apiKey) return { ok: false, erro: "SendGrid sem API Key." };
  if (!sg.fromEmail) return { ok: false, erro: "Informe o e-mail do remetente (from) — ele precisa estar verificado no SendGrid." };

  const resposta = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${sg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.para }] }],
      from: { email: sg.fromEmail, ...(sg.fromName ? { name: sg.fromName } : {}) },
      subject: params.assunto,
      ...(params.headers ? { headers: params.headers } : {}),
      // A API exige text/plain ANTES de text/html.
      content: [
        { type: "text/plain", value: params.texto ?? htmlParaTexto(params.html) },
        { type: "text/html", value: params.html },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (resposta.ok) return { ok: true };
  const corpo = (await resposta.json().catch(() => null)) as { errors?: { message?: string }[] } | null;
  return { ok: false, erro: `SendGrid: ${corpo?.errors?.[0]?.message ?? `erro ${resposta.status}`}` };
}

// ===== API pública =====

export async function enviarEmail(params: EmailParams, opcoes: { config?: ConfigEmail | null } = {}): Promise<ResultadoEmail> {
  try {
    const config = opcoes.config !== undefined ? opcoes.config : await carregarConfigEmail();
    switch (config?.provedor ?? "resend") {
      case "smtp":
        return await enviarPorSmtp(config as ConfigEmail, params);
      case "sendgrid":
        return await enviarPorSendGrid(config as ConfigEmail, params);
      default:
        return await enviarPorResend(config, params);
    }
  } catch (erro) {
    return { ok: false, erro: mensagemErro(erro, "Falha ao enviar o e-mail.") };
  }
}

// O provedor em uso tem o mínimo pra enviar? (Substitui a checagem antiga, só de env:
// resendConfigurado().) Sem configuração no banco, vale o Resend do ambiente.
export async function emailConfigurado(): Promise<boolean> {
  const config = await carregarConfigEmail();
  switch (config?.provedor ?? "resend") {
    case "smtp":
      return validarSmtp((config as ConfigEmail).smtp) === null;
    case "sendgrid":
      return !!config?.sendgrid.apiKey && !!config.sendgrid.fromEmail;
    default:
      return !!resolverResend(config).apiKey;
  }
}

// "Testar conexão" de cada provedor, com a config que o admin digitou (já mesclada
// com a salva). Não envia nenhum e-mail.
export async function testarProvedor(provedor: ProvedorEmail, config: ConfigEmail): Promise<ResultadoTesteProvedor> {
  try {
    if (provedor === "resend") {
      const { apiKey } = resolverResend(config);
      if (!apiKey) return { ok: false, erro: "Informe a API Key do Resend (ou defina RESEND_API_KEY no ambiente)." };
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.ok) return { ok: true };
      const corpo = (await r.json().catch(() => null)) as { name?: string; message?: string } | null;
      // Chave "só de envio" é válida, apenas não pode listar domínios.
      if (corpo?.name === "restricted_api_key") {
        return { ok: true, aviso: "Chave válida, restrita a envio de e-mails (não lista domínios) — é o esperado." };
      }
      return { ok: false, erro: `Resend recusou a chave: ${corpo?.message ?? `erro ${r.status}`}` };
    }

    if (provedor === "sendgrid") {
      if (!config.sendgrid.apiKey) return { ok: false, erro: "Informe a API Key do SendGrid." };
      const r = await fetch("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: `Bearer ${config.sendgrid.apiKey}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.ok) {
        return config.sendgrid.fromEmail
          ? { ok: true }
          : { ok: true, aviso: "Chave válida, mas falta o e-mail do remetente (precisa estar verificado no SendGrid)." };
      }
      return { ok: false, erro: r.status === 401 || r.status === 403 ? "O SendGrid recusou a API Key." : `SendGrid respondeu erro ${r.status}.` };
    }

    const invalido = validarSmtp(config.smtp);
    if (invalido) return { ok: false, erro: invalido };
    await criarTransporte(config.smtp).verify();
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemErro(erro, "Falha ao conectar.") };
  }
}
