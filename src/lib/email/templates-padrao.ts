// Templates padrão dos e-mails do sistema. Sem dependência de servidor: a tela de
// edição (client) usa pra "Restaurar padrão" e pro preview; o envio usa como rede de
// segurança se a tabela email_templates estiver indisponível; a migration semeia a
// tabela com ESTE mesmo conteúdo (gerada a partir daqui — ver comentário da migration).

export const EMAIL_TEMPLATE_IDS = [
  "acesso",
  "cobranca",
  "boas_vindas",
  "agendamento",
  "recuperacao_senha",
  "lead_confirmacao",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export function isEmailTemplateId(valor: unknown): valor is EmailTemplateId {
  return typeof valor === "string" && (EMAIL_TEMPLATE_IDS as readonly string[]).includes(valor);
}

export type TemplatePadrao = {
  id: EmailTemplateId;
  nome: string;
  descricao: string;
  assunto: string;
  corpo_html: string;
  variaveis: string[];
  // Valores de exemplo (preview e e-mail de teste).
  exemplo: Record<string, string>;
};

const COR_HEADER = "#0f172a";
const COR_TEXTO = "#1e293b";
const COR_CTA = "#06b6d4";

// Moldura comum, com estilos inline (a maioria dos clientes de e-mail ignora <style>).
function moldura(conteudo: string): string {
  return `<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="background:${COR_HEADER};color:#ffffff;padding:24px 32px;text-align:center;">
    <span style="font-size:20px;font-weight:bold;">{nome_escola}</span>
  </div>
  <div style="padding:32px;color:${COR_TEXTO};font-size:15px;line-height:1.6;">
${conteudo}
  </div>
  <div style="background:#f8fafc;color:#64748b;padding:16px 32px;font-size:12px;text-align:center;">
    <p style="margin:0;">Este e-mail foi enviado por {nome_escola}.</p>
  </div>
</div>`;
}

function botao(texto: string, href: string): string {
  return `    <p style="text-align:center;margin:24px 0;">
      <a href="${href}" style="display:inline-block;background:${COR_CTA};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">${texto}</a>
    </p>`;
}

export const TEMPLATES_PADRAO: Record<EmailTemplateId, TemplatePadrao> = {
  acesso: {
    id: "acesso",
    nome: "Dados de acesso",
    descricao: "Enviado ao criar a matrícula, com os dados de acesso ao portal do aluno.",
    assunto: "Seu acesso ao portal do aluno — {nome_produto}",
    corpo_html: moldura(`    <p>Olá, {nome_cliente}!</p>
    <p>Sua matrícula em <strong>{nome_produto}</strong> foi confirmada. Estes são os seus dados de acesso ao portal do aluno:</p>
    <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;">
      <strong>E-mail:</strong> {email_cliente}<br>
      <strong>Senha:</strong> {senha}
    </p>
${botao("Acessar o portal →", "{link_acesso}")}
    <p>Por segurança, altere a senha no seu primeiro acesso.</p>`),
    variaveis: ["nome_cliente", "email_cliente", "senha", "nome_produto", "link_acesso", "nome_escola"],
    exemplo: {
      nome_cliente: "Maria Silva",
      email_cliente: "maria@exemplo.com",
      senha: "Ab3dE7fG",
      nome_produto: "Técnico em Enfermagem",
      link_acesso: "https://sistemagestaogenezi.vercel.app/entrar",
      nome_escola: "GÊNEZI Educação",
    },
  },

  cobranca: {
    id: "cobranca",
    nome: "Cobrança gerada",
    descricao: "Enviado quando uma cobrança é gerada, com o link do boleto e/ou PIX.",
    assunto: "Cobrança: {descricao} — vence em {vencimento}",
    corpo_html: moldura(`    <p>Olá, {nome_cliente}!</p>
    <p>Geramos uma cobrança para você:</p>
    <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;">
      <strong>{descricao}</strong><br>
      Valor: <strong>{valor}</strong><br>
      Vencimento: <strong>{vencimento}</strong>
    </p>
    {#se link_boleto}${botao("Ver boleto / fatura →", "{link_boleto}")}{/se}
    {#se link_pix}<p>Prefere pagar por PIX? <a href="{link_pix}">Abra a fatura e escolha PIX</a>.</p>{/se}
    {#se codigo_pix}<p><strong>PIX copia e cola:</strong></p>
    <p style="background:#f1f5f9;padding:10px 12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;">{codigo_pix}</p>{/se}
    <p>Se você já pagou, desconsidere este e-mail.</p>`),
    variaveis: ["nome_cliente", "descricao", "valor", "vencimento", "link_boleto", "link_pix", "codigo_pix", "nome_escola"],
    exemplo: {
      nome_cliente: "Maria Silva",
      descricao: "Parcela 2/6 — Técnico em Enfermagem",
      valor: "R$ 350,00",
      vencimento: "10/10/2026",
      link_boleto: "https://sistemagestaogenezi.vercel.app/fatura/exemplo",
      link_pix: "https://sistemagestaogenezi.vercel.app/fatura/exemplo",
      codigo_pix: "00020126580014br.gov.bcb.pix0136exemplo5204000053039865802BR",
      nome_escola: "GÊNEZI Educação",
    },
  },

  boas_vindas: {
    id: "boas_vindas",
    nome: "Boas-vindas",
    descricao: "Enviado ao criar a matrícula, dando as boas-vindas ao aluno.",
    assunto: "Bem-vindo(a) à {nome_escola}!",
    corpo_html: moldura(`    <p>Olá, {nome_cliente}!</p>
    <p>É uma alegria ter você conosco na <strong>{nome_escola}</strong>. Sua matrícula foi realizada com sucesso.</p>
    <p>Em breve você receberá as próximas orientações. Qualquer dúvida, é só responder este e-mail ou falar com a nossa secretaria.</p>
    <p>Bons estudos!</p>`),
    variaveis: ["nome_cliente", "nome_escola"],
    exemplo: { nome_cliente: "Maria Silva", nome_escola: "GÊNEZI Educação" },
  },

  agendamento: {
    id: "agendamento",
    nome: "Confirmação de agendamento",
    descricao: "Enviado quando alguém agenda uma visita pela página pública (se informou e-mail).",
    assunto: "Agendamento confirmado — {data} às {horario}",
    corpo_html: moldura(`    <p>Olá, {nome_cliente}!</p>
    <p>Seu agendamento está confirmado:</p>
    <p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;">
      <strong>{nome_pagina}</strong><br>
      {dia_semana}, {data} às <strong>{horario}</strong>
    </p>
    <p>Precisando remarcar, entre em contato com a nossa secretaria. Esperamos você!</p>`),
    variaveis: ["nome_cliente", "data", "horario", "dia_semana", "nome_pagina", "nome_escola"],
    exemplo: {
      nome_cliente: "Maria Silva",
      data: "25/09/2026",
      horario: "14:00",
      dia_semana: "Sexta-feira",
      nome_pagina: "Visita à escola",
      nome_escola: "GÊNEZI Educação",
    },
  },

  recuperacao_senha: {
    id: "recuperacao_senha",
    nome: "Recuperação de senha",
    descricao: "Enviado quando o aluno pede para redefinir a senha.",
    assunto: "Redefinição de senha — {nome_escola}",
    corpo_html: moldura(`    <p>Olá, {nome_cliente}!</p>
    <p>Recebemos uma solicitação para redefinir a sua senha.</p>
${botao("Redefinir senha →", "{link_recuperacao}")}
    <p>Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p>`),
    variaveis: ["nome_cliente", "link_recuperacao", "nome_escola"],
    exemplo: {
      nome_cliente: "Maria Silva",
      link_recuperacao: "https://sistemagestaogenezi.vercel.app/redefinir-senha?token=exemplo",
      nome_escola: "GÊNEZI Educação",
    },
  },

  lead_confirmacao: {
    id: "lead_confirmacao",
    nome: "Confirmação de inscrição (campanha)",
    descricao: "Enviado quando alguém preenche o formulário de uma campanha (se informou e-mail).",
    assunto: "Recebemos sua inscrição — {nome_campanha}",
    corpo_html: moldura(`    <p>Olá, {nome_cliente}!</p>
    <p>Recebemos a sua inscrição em <strong>{nome_campanha}</strong>. Obrigado pelo interesse!</p>
    <p>Nossa equipe entrará em contato em breve pelo telefone que você informou.</p>`),
    variaveis: ["nome_cliente", "nome_campanha", "nome_escola"],
    exemplo: { nome_cliente: "Maria Silva", nome_campanha: "Bolsas de Enfermagem 2026", nome_escola: "GÊNEZI Educação" },
  },
};

export function getTemplatePadrao(id: EmailTemplateId): TemplatePadrao {
  return TEMPLATES_PADRAO[id];
}
