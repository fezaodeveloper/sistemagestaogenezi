import "server-only";

import { emailConfigurado, enviarEmail } from "@/lib/resend/client";
import { renderizarTemplate } from "@/lib/email/templates";
import {
  templateAcessoConecta,
  templateBoasVindas,
  templateCertificado,
  templateLembretePagamento,
  templatePremioDigital,
  templateRecuperacaoSenha,
} from "@/lib/resend/templates";

// Funções de alto nível: cada uma monta o template certo e chama
// enviarEmail. Best-effort de verdade (REGRA da tarefa) — nunca lançam,
// mesmo que resendConfigurado() já garanta isso por dentro de enviarEmail;
// o try/catch aqui é uma segunda camada, caso o template em si (interpolação
// de string) lance por algum motivo inesperado.

export async function enviarBoasVindas(para: string, nome: string, senha: string): Promise<boolean> {
  if (!(await emailConfigurado())) return false;
  try {
    const { subject, html } = templateBoasVindas(nome, para, senha);
    return await enviarEmail({ to: para, subject, html });
  } catch {
    return false;
  }
}

export async function enviarAcessoConecta(
  para: string,
  nome: string,
  recoveryLink: string,
  plano: string,
): Promise<boolean> {
  if (!(await emailConfigurado())) return false;
  try {
    const { subject, html } = templateAcessoConecta(nome, recoveryLink, plano, para);
    return await enviarEmail({ to: para, subject, html });
  } catch {
    return false;
  }
}

export async function enviarRecuperacaoSenha(
  para: string,
  nome: string,
  recoveryLink: string,
): Promise<boolean> {
  if (!(await emailConfigurado())) return false;
  try {
    // Template editável em /admin/configuracoes/email (id "recuperacao_senha"). Se o
    // admin o desativou, não envia; se o render falhar, cai no texto legado abaixo.
    const renderizado = await renderizarTemplate("recuperacao_senha", { nome_cliente: nome, link_recuperacao: recoveryLink }).catch(
      () => undefined,
    );
    if (renderizado === null) return false;
    if (renderizado) return await enviarEmail({ to: para, subject: renderizado.assunto, html: renderizado.html });

    const { subject, html } = templateRecuperacaoSenha(nome, recoveryLink, para);
    return await enviarEmail({ to: para, subject, html });
  } catch {
    return false;
  }
}

export async function enviarPremioDigital(
  para: string,
  nome: string,
  nomePremio: string,
  conteudo: string,
): Promise<boolean> {
  if (!(await emailConfigurado())) return false;
  try {
    const { subject, html } = templatePremioDigital(nome, nomePremio, conteudo, para);
    return await enviarEmail({ to: para, subject, html });
  } catch {
    return false;
  }
}

export async function enviarCertificado(
  para: string,
  nome: string,
  nomeCurso: string,
  linkCertificado: string,
): Promise<boolean> {
  if (!(await emailConfigurado())) return false;
  try {
    const { subject, html } = templateCertificado(nome, nomeCurso, linkCertificado, para);
    return await enviarEmail({ to: para, subject, html });
  } catch {
    return false;
  }
}

export async function enviarLembretePagamento(
  para: string,
  nome: string,
  valor: number,
  dataVencimento: string,
  linkPagamento: string,
): Promise<boolean> {
  if (!(await emailConfigurado())) return false;
  try {
    const { subject, html } = templateLembretePagamento(nome, valor, dataVencimento, linkPagamento, para);
    return await enviarEmail({ to: para, subject, html });
  } catch {
    return false;
  }
}
