import "server-only";

// Layout HTML compartilhado por todos os templates de email — inline de
// propósito (REGRA da tarefa: sem CSS externo, a maioria dos clientes de
// email não carrega <style> em <head> nem arquivos externos).
const COR_HEADER = "#0f172a";
const COR_TEXTO = "#1e293b";
const COR_CTA = "#06b6d4";
const COR_FOOTER_BG = "#f8fafc";
const COR_FOOTER_TEXTO = "#64748b";

function layoutBase(email: string, conteudoHtml: string): string {
  return `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial, sans-serif;">
      <div style="background:${COR_HEADER};color:#ffffff;padding:24px 32px;text-align:center;">
        <span style="font-size:20px;font-weight:bold;">GÊNEZI Educação</span>
      </div>
      <div style="padding:32px;color:${COR_TEXTO};font-size:15px;line-height:1.6;">
        ${conteudoHtml}
      </div>
      <div style="background:${COR_FOOTER_BG};color:${COR_FOOTER_TEXTO};padding:16px 32px;font-size:12px;text-align:center;">
        <p style="margin:0;">Gênezi Educação — Propriá/SE</p>
        <p style="margin:4px 0 0;">Este email foi enviado para ${email}</p>
      </div>
    </div>
  `;
}

function botaoCta(texto: string, href: string): string {
  return `
    <p style="text-align:center;margin:24px 0;">
      <a href="${href}" style="display:inline-block;background:${COR_CTA};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">${texto}</a>
    </p>
  `;
}

export type EmailTemplate = { subject: string; html: string };

// Todos os templates recebem "email" (o destinatário) mesmo quando não
// listado no pedido original — o layout base sempre mostra "Este email foi
// enviado para {email}" no rodapé, então precisa do valor em todo template,
// não só no de boas-vindas. Quem chama (src/lib/resend/emails.ts) já tem
// esse valor em mãos (é o próprio "para" de cada função de alto nível).

export function templateBoasVindas(nome: string, email: string, senha: string): EmailTemplate {
  const conteudo = `
    <p>Olá, ${nome}!</p>
    <p>Seja bem-vindo(a) à Gênezi Educação Profissional. Sua conta já está pronta.</p>
    <p><strong>Seus dados de acesso:</strong><br>
    Email: ${email}<br>
    Senha temporária: ${senha}</p>
    ${botaoCta("Acessar o portal →", "https://sistemagestaogenezi.vercel.app/entrar")}
    <p>Recomendamos trocar a senha no primeiro acesso.</p>
  `;
  return { subject: "🎓 Bem-vindo à Gênezi Educação!", html: layoutBase(email, conteudo) };
}

export function templateAcessoConecta(
  nome: string,
  recoveryLink: string,
  plano: string,
  email: string,
): EmailTemplate {
  const conteudo = `
    <p>Olá, ${nome}!</p>
    <p>Pagamento confirmado! Seu plano ${plano} foi ativado.</p>
    <p>Clique no botão abaixo para criar sua senha e acessar o portal de empregos:</p>
    ${botaoCta("Criar minha senha →", recoveryLink)}
    <p>O link expira em 24 horas.</p>
    <p>Após criar a senha, acesse: sistemagestaogenezi.vercel.app/entrar</p>
  `;
  return { subject: "🎉 Gênezi Conecta — Seu acesso está pronto!", html: layoutBase(email, conteudo) };
}

export function templateRecuperacaoSenha(nome: string, recoveryLink: string, email: string): EmailTemplate {
  const conteudo = `
    <p>Olá, ${nome}!</p>
    <p>Recebemos uma solicitação para redefinir sua senha.</p>
    ${botaoCta("Redefinir senha →", recoveryLink)}
    <p>Se não foi você, ignore este email.</p>
    <p>O link expira em 24 horas.</p>
  `;
  return { subject: "🔐 Redefinir sua senha — Gênezi", html: layoutBase(email, conteudo) };
}

export function templatePremioDigital(
  nome: string,
  nomePremio: string,
  conteudoPremio: string,
  email: string,
): EmailTemplate {
  const conteudo = `
    <p>Olá, ${nome}!</p>
    <p>Parabéns! Você resgatou: <strong>${nomePremio}</strong></p>
    <div style="background:${COR_FOOTER_BG};border-radius:8px;padding:16px;margin:16px 0;">
      ${conteudoPremio}
    </div>
    <p>Continue acumulando pontos para mais recompensas!</p>
  `;
  return { subject: `🎁 Seu prêmio chegou! — ${nomePremio}`, html: layoutBase(email, conteudo) };
}

export function templateCertificado(
  nome: string,
  nomeCurso: string,
  linkCertificado: string,
  email: string,
): EmailTemplate {
  const conteudo = `
    <p>Olá, ${nome}!</p>
    <p>Parabéns pela conclusão de ${nomeCurso}!</p>
    ${botaoCta("Baixar certificado →", linkCertificado)}
  `;
  return { subject: `🏆 Certificado disponível — ${nomeCurso}`, html: layoutBase(email, conteudo) };
}

export function templateLembretePagamento(
  nome: string,
  valor: number,
  dataVencimento: string,
  linkPagamento: string,
  email: string,
): EmailTemplate {
  const valorFormatado = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const conteudo = `
    <p>Olá, ${nome}!</p>
    <p>Sua parcela de R$ ${valorFormatado} vence em ${dataVencimento}.</p>
    ${botaoCta("Pagar agora →", linkPagamento)}
    <p>Mantenha seus pagamentos em dia para continuar pontuando.</p>
  `;
  return { subject: "⚠️ Parcela vencendo — Gênezi", html: layoutBase(email, conteudo) };
}
