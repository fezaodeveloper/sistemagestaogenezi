import "server-only";

import { enviarWhatsApp } from "@/lib/whatsapp/enviar";

const URL_SITE_PADRAO = "https://escola.genezi.com.br";

function urlPortal(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO).replace(/\/+$/, "");
}

// WhatsApp para a EMPRESA (não para o admin — isso já existe em src/lib/conecta/telegram.ts).
// Best-effort: nunca lança, mesma política do resto do projeto — o cadastro/aprovação já
// aconteceu com sucesso antes de qualquer chamada aqui.

export async function enviarWhatsappCadastroEmpresa(whatsapp: string, nomeEmpresa: string, email: string): Promise<void> {
  try {
    const mensagem = [
      `Olá, ${nomeEmpresa}! 👋`,
      "",
      "Seu cadastro na Gênezi Conecta foi recebido e está em análise.",
      `Usuário: ${email}`,
      `Link de acesso: ${urlPortal()}/empresa/login`,
      "",
      "Você receberá uma confirmação em breve. Qualquer dúvida, entre em contato.",
    ].join("\n");

    await enviarWhatsApp(whatsapp, mensagem);
  } catch {
    // Best-effort — ver comentário acima.
  }
}

export async function enviarWhatsappEmpresaAprovada(whatsapp: string, nomeEmpresa: string, email: string): Promise<void> {
  try {
    const mensagem = [
      `${nomeEmpresa} ✅`,
      "",
      "Seu cadastro na Gênezi Conecta foi aprovado!",
      `Acesse ${urlPortal()}/empresa/login com o usuário ${email} e a senha cadastrada no seu cadastro.`,
    ].join("\n");

    await enviarWhatsApp(whatsapp, mensagem);
  } catch {
    // Best-effort — ver comentário acima.
  }
}
