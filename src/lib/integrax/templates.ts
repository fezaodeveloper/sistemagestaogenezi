// Templates de SMS da IntegraX — definições, mensagens padrão e renderização de placeholders.
// Sem dependência de servidor: a tela (contador, prévia, "restaurar padrão") e o envio
// compartilham EXATAMENTE o mesmo código.
//
// As mensagens padrão abaixo são as que já estavam no código de notificacoes.ts antes dos
// templates editáveis (agora com {placeholders}) e são as mesmas semeadas em sms_templates.

import { normalizarTextoSms, SMS_LIMITE_CARACTERES } from "@/lib/integrax/texto";

export const SMS_TEMPLATE_IDS = [
  "acesso",
  "cobranca",
  "pix_gerado",
  "pagamento_confirmado",
  "agendamento_lembrete",
  "lead_confirmacao",
] as const;
export type SmsTemplateId = (typeof SMS_TEMPLATE_IDS)[number];

export type SmsPlaceholder = { chave: string; descricao: string; exemplo: string };

export type SmsTemplateDefinicao = {
  id: SmsTemplateId;
  nome: string;
  // Quando o SMS sai. null = ainda não há gatilho automático no sistema (o template já pode ser
  // editado; passa a valer quando o gatilho existir).
  gatilho: string | null;
  padrao: string;
  placeholders: SmsPlaceholder[];
  // Variáveis que podem ser abreviadas (com "...") se a mensagem passar de 160 caracteres.
  encurtaveis: string[];
};

const NOME_ESCOLA: SmsPlaceholder = { chave: "nome_escola", descricao: "Nome da escola", exemplo: "GENEZI" };

const P_ALUNO: SmsPlaceholder = { chave: "nome_aluno", descricao: "Primeiro nome do aluno", exemplo: "Maria" };
const P_CURSO: SmsPlaceholder = { chave: "nome_curso", descricao: "Nome do curso", exemplo: "Informatica Basica" };
const P_PARCELA: SmsPlaceholder = { chave: "parcela", descricao: "Número da parcela (ex.: 2/6)", exemplo: "2/6" };
const P_VALOR: SmsPlaceholder = { chave: "valor", descricao: "Valor da parcela", exemplo: "R$ 149,90" };
const P_VENCIMENTO: SmsPlaceholder = { chave: "vencimento", descricao: "Data de vencimento", exemplo: "10/10/2026" };

export const SMS_TEMPLATES: Record<SmsTemplateId, SmsTemplateDefinicao> = {
  acesso: {
    id: "acesso",
    nome: "Acesso / matrícula criada",
    gatilho: "Quando uma matrícula é criada.",
    padrao: "GENEZI: Ola, {nome_aluno}! Matricula confirmada em {nome_curso}. Acesse a plataforma com o e-mail {email}.",
    placeholders: [P_ALUNO, P_CURSO, { chave: "email", descricao: "E-mail de acesso do aluno", exemplo: "maria@email.com" }, NOME_ESCOLA],
    encurtaveis: ["nome_curso"],
  },
  cobranca: {
    id: "cobranca",
    nome: "Cobrança gerada",
    gatilho: "Quando uma cobrança de parcela é gerada.",
    padrao: "GENEZI: {nome_aluno}, parcela {parcela} de {valor} vence em {vencimento}. Curso: {nome_curso}.",
    placeholders: [P_ALUNO, P_PARCELA, P_VALOR, P_VENCIMENTO, P_CURSO, NOME_ESCOLA],
    encurtaveis: ["nome_curso"],
  },
  pix_gerado: {
    id: "pix_gerado",
    nome: "PIX gerado",
    // Não existe evento de PIX no sistema hoje (a cobrança sai como fatura/boleto do gateway).
    gatilho: null,
    padrao: "GENEZI: {nome_aluno}, o PIX da parcela {parcela} ({valor}) do curso {nome_curso} foi gerado. Vence em {vencimento}.",
    placeholders: [P_ALUNO, P_PARCELA, P_VALOR, P_VENCIMENTO, P_CURSO, NOME_ESCOLA],
    encurtaveis: ["nome_curso"],
  },
  pagamento_confirmado: {
    id: "pagamento_confirmado",
    nome: "Pagamento confirmado",
    gatilho: "Quando o pagamento de uma parcela é confirmado.",
    padrao: "GENEZI: Ola, {nome_aluno}! Recebemos o pagamento da parcela {parcela} ({valor}) de {nome_curso}. Obrigado!",
    placeholders: [P_ALUNO, P_PARCELA, P_VALOR, P_CURSO, NOME_ESCOLA],
    encurtaveis: ["nome_curso"],
  },
  agendamento_lembrete: {
    id: "agendamento_lembrete",
    nome: "Lembrete de agendamento",
    gatilho: "Um dia antes do agendamento (cron diário).",
    padrao: "GENEZI: {nome_cliente}, lembrete: seu agendamento e amanha, dia {data} as {hora}. Ate la!",
    placeholders: [
      { chave: "nome_cliente", descricao: "Primeiro nome do cliente", exemplo: "Joao" },
      { chave: "data", descricao: "Data do agendamento", exemplo: "22/09/2026" },
      { chave: "hora", descricao: "Horário do agendamento", exemplo: "14:30" },
      NOME_ESCOLA,
    ],
    encurtaveis: [],
  },
  lead_confirmacao: {
    id: "lead_confirmacao",
    nome: "Confirmação de interesse (lead)",
    gatilho: "Quando alguém se cadastra pelo formulário público (novo lead).",
    padrao: "GENEZI: Ola, {nome_cliente}! Recebemos seu interesse em {curso_interesse}. Em breve entraremos em contato.",
    placeholders: [
      { chave: "nome_cliente", descricao: "Primeiro nome do lead", exemplo: "Joao" },
      { chave: "curso_interesse", descricao: "Curso de interesse", exemplo: "Informatica Basica" },
      NOME_ESCOLA,
    ],
    encurtaveis: ["curso_interesse"],
  },
};

export function isSmsTemplateId(valor: unknown): valor is SmsTemplateId {
  return typeof valor === "string" && (SMS_TEMPLATE_IDS as readonly string[]).includes(valor);
}

// ===== Recuperação escalonada de leads =====

export const RECUPERACAO_PLACEHOLDERS: SmsPlaceholder[] = [
  { chave: "nome_cliente", descricao: "Primeiro nome do lead", exemplo: "Joao" },
  { chave: "nome_escola", descricao: "Nome da escola", exemplo: "GENEZI" },
  { chave: "curso_interesse", descricao: "Curso de interesse", exemplo: "Informatica Basica" },
  { chave: "link_agendamento", descricao: "Link para agendar uma conversa", exemplo: "https://site.com/agendar/visita" },
];

// Variáveis que a recuperação pode abreviar se a mensagem passar de 160 caracteres.
export const RECUPERACAO_ENCURTAVEIS = ["curso_interesse", "nome_escola"];

// ===== Renderização =====

// Abrevia com "." no fim (mesmo comportamento do encurtar() que existia em notificacoes.ts).
export function encurtarTexto(texto: string | null | undefined, maximo: number): string {
  const limpo = normalizarTextoSms(texto ?? "");
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}.`;
}

// Chaves {placeholder} usadas num texto.
export function placeholdersUsados(modelo: string): string[] {
  return Array.from(new Set(Array.from(modelo.matchAll(/\{(\w+)\}/g), (m) => m[1])));
}

// Chaves usadas no texto que NÃO estão na lista permitida (typo do admin, ex.: {nome_alno}).
export function placeholdersDesconhecidos(modelo: string, permitidos: string[]): string[] {
  return placeholdersUsados(modelo).filter((chave) => !permitidos.includes(chave));
}

// Troca cada {chave} pelo valor e normaliza o texto pra GSM-7. Se passar de 160 caracteres,
// abrevia (nessa ordem) as variáveis `encurtaveis` — assim o corte cai no nome do curso, não no
// meio de um dado importante (o mesmo critério do antigo caber()). Chave sem valor fica como está.
export function renderizarSms(
  modelo: string,
  valores: Record<string, string>,
  encurtaveis: string[] = [],
): string {
  const v: Record<string, string> = { ...valores };
  const montar = () => normalizarTextoSms(modelo.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in v ? v[chave] : inteiro)));

  let texto = montar();
  for (const chave of encurtaveis) {
    if (texto.length <= SMS_LIMITE_CARACTERES) break;
    if (!(chave in v) || !modelo.includes(`{${chave}}`)) continue;
    const excesso = texto.length - SMS_LIMITE_CARACTERES;
    v[chave] = encurtarTexto(v[chave], Math.max(8, normalizarTextoSms(v[chave]).length - excesso));
    texto = montar();
  }
  return texto;
}

// Valores de exemplo para a prévia da tela.
export function valoresDeExemplo(placeholders: SmsPlaceholder[]): Record<string, string> {
  return Object.fromEntries(placeholders.map((p) => [p.chave, p.exemplo]));
}
