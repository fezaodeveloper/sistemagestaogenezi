// Catálogo dos 13 templates de WhatsApp (GênZap) — definições, mensagens padrão e renderização
// de placeholders. SEM "server-only" de propósito: importado tanto no servidor (disparos
// automáticos, Server Actions) quanto pelo editor no navegador (client component, prévia em
// tempo real) — a leitura do banco (buscar o template salvo) fica isolada em
// src/lib/whatsapp/render.ts, que é server-only.
//
// Os 4 primeiros (matricula_criada, lembrete_aula, falta_aula, recontato_lead) MIGRARAM de
// colunas de `whatsapp_config` (ver a migration) — variáveis LEGADAS de propósito, iguais às já
// usadas por src/lib/mensagens/mensagens.ts, pra não quebrar esses 4 envios já reais.

export const WHATSAPP_TEMPLATE_IDS = [
  "matricula_criada",
  "lembrete_aula",
  "falta_aula",
  "recontato_lead",
  "agendamento_lembrete",
  "agendamento_cancelado",
  "agendamento_falta",
  "cobranca_gerada",
  "cobranca_atrasada_d1",
  "cobranca_atrasada_d3",
  "cobranca_atrasada_d7",
  "cobranca_atrasada_d15",
  "lead_followup",
] as const;
export type WhatsappTemplateId = (typeof WHATSAPP_TEMPLATE_IDS)[number];

export function isWhatsappTemplateId(valor: unknown): valor is WhatsappTemplateId {
  return typeof valor === "string" && (WHATSAPP_TEMPLATE_IDS as readonly string[]).includes(valor);
}

export type WhatsappPlaceholder = { chave: string; descricao: string; exemplo: string };

export type WhatsappTemplateDefinicao = {
  id: WhatsappTemplateId;
  nome: string;
  gatilho: string;
  padrao: string;
  placeholders: WhatsappPlaceholder[];
};

const P_NOME: WhatsappPlaceholder = { chave: "nome", descricao: "Primeiro nome do destinatário", exemplo: "Maria" };
const P_DATA: WhatsappPlaceholder = { chave: "data", descricao: "Data (dd/mm/aaaa)", exemplo: "25/09/2026" };
const P_HORARIO: WhatsappPlaceholder = { chave: "horario", descricao: "Horário", exemplo: "14:30" };
const P_VALOR: WhatsappPlaceholder = { chave: "valor", descricao: "Valor da parcela", exemplo: "R$ 149,90" };
const P_VENCIMENTO: WhatsappPlaceholder = { chave: "vencimento", descricao: "Data de vencimento", exemplo: "10/10/2026" };
const P_LINK_BOLETO: WhatsappPlaceholder = { chave: "link_boleto", descricao: "Link do boleto/fatura", exemplo: "https://asaas.com/i/abc123" };
const P_DIAS_ATRASO: WhatsappPlaceholder = { chave: "dias_atraso", descricao: "Dias de atraso", exemplo: "7" };
const P_NOME_ESCOLA: WhatsappPlaceholder = { chave: "nome_escola", descricao: "Nome da escola", exemplo: "GÊNEZI" };

export const WHATSAPP_TEMPLATES: Record<WhatsappTemplateId, WhatsappTemplateDefinicao> = {
  matricula_criada: {
    id: "matricula_criada",
    nome: "Matrícula criada",
    gatilho: "Ao criar uma matrícula (envio automático já existente — src/lib/mensagens).",
    padrao:
      "Olá, {nome_aluno}! Sua matrícula no curso {nome_curso} (turma {nome_turma}) foi confirmada. Sua primeira aula é em {data_aula} às {horario_aula}. Nos vemos lá!",
    placeholders: [
      { chave: "nome_aluno", descricao: "Primeiro nome do aluno", exemplo: "Maria" },
      { chave: "nome_curso", descricao: "Nome do curso", exemplo: "Informática Básica" },
      { chave: "nome_turma", descricao: "Nome da turma", exemplo: "Turma A - Noite" },
      { chave: "data_aula", descricao: "Data da primeira aula", exemplo: "25/09/2026" },
      { chave: "horario_aula", descricao: "Horário da aula", exemplo: "19:00" },
    ],
  },
  lembrete_aula: {
    id: "lembrete_aula",
    nome: "Lembrete de aula",
    gatilho: "Um dia antes da aula (envio automático já existente — cron lembretes-aula).",
    padrao: "Oi, {nome_aluno}! Lembrete: amanhã ({data_aula}) às {horario_aula} tem aula de {nome_curso}. Te esperamos!",
    placeholders: [
      { chave: "nome_aluno", descricao: "Primeiro nome do aluno", exemplo: "Maria" },
      { chave: "nome_curso", descricao: "Nome do curso", exemplo: "Informática Básica" },
      { chave: "data_aula", descricao: "Data da aula", exemplo: "25/09/2026" },
      { chave: "horario_aula", descricao: "Horário da aula", exemplo: "19:00" },
    ],
  },
  falta_aula: {
    id: "falta_aula",
    nome: "Falta em aula",
    gatilho: "Ao registrar falta do aluno numa aula (envio automático já existente).",
    padrao: "Olá, {nome_aluno}! Sentimos sua falta na aula de {nome_curso} em {data_aula}. Esperamos você na próxima!",
    placeholders: [
      { chave: "nome_aluno", descricao: "Primeiro nome do aluno", exemplo: "Maria" },
      { chave: "nome_curso", descricao: "Nome do curso", exemplo: "Informática Básica" },
      { chave: "data_aula", descricao: "Data da aula", exemplo: "25/09/2026" },
    ],
  },
  recontato_lead: {
    id: "recontato_lead",
    nome: "Recontato de lead",
    gatilho: "Envio manual (tela de leads) ou automático ao criar turma nova (envio já existente).",
    padrao: "Olá, {nome_lead}! Temos novidades sobre o curso {nome_curso}, turma {nome_turma}, com início em {data_inicio_turma}. Quer saber mais?",
    placeholders: [
      { chave: "nome_lead", descricao: "Primeiro nome do lead", exemplo: "João" },
      { chave: "nome_curso", descricao: "Nome do curso", exemplo: "Informática Básica" },
      { chave: "nome_turma", descricao: "Nome da turma nova", exemplo: "Turma B - Manhã" },
      { chave: "data_inicio_turma", descricao: "Início da turma", exemplo: "01/11/2026" },
    ],
  },
  agendamento_lembrete: {
    id: "agendamento_lembrete",
    nome: "Lembrete de agendamento",
    gatilho: "Um dia antes do agendamento (cron lembrete-agendamentos).",
    padrao: "Olá, {nome}! 👋 Passando para lembrar do seu agendamento na {dia_semana}, dia {data} às {horario}. Até lá!",
    placeholders: [P_NOME, P_DATA, P_HORARIO, { chave: "dia_semana", descricao: "Dia da semana", exemplo: "quinta-feira" }],
  },
  agendamento_cancelado: {
    id: "agendamento_cancelado",
    nome: "Agendamento cancelado",
    gatilho: "Ao mudar o status do agendamento para \"Cancelado\".",
    padrao: "Olá, {nome}. Seu agendamento do dia {data} às {horario} foi cancelado. {motivo}",
    placeholders: [P_NOME, P_DATA, P_HORARIO, { chave: "motivo", descricao: "Motivo do cancelamento (opcional)", exemplo: "" }],
  },
  agendamento_falta: {
    id: "agendamento_falta",
    nome: "Falta no agendamento",
    gatilho: "Ao mudar o status do agendamento para \"Faltou\".",
    padrao: "Olá, {nome}, sentimos sua falta no agendamento de {data} às {horario}. Se quiser remarcar, é só nos chamar!",
    placeholders: [P_NOME, P_DATA, P_HORARIO],
  },
  cobranca_gerada: {
    id: "cobranca_gerada",
    nome: "Cobrança gerada",
    gatilho: "Ao gerar uma cobrança no Asaas (Financeiro > Gerar cobrança).",
    padrao: "Olá, {nome}! Sua cobrança de {valor} referente a {descricao} foi gerada, com vencimento em {vencimento}. Pagamento: {link_boleto}",
    placeholders: [
      P_NOME,
      P_VALOR,
      P_VENCIMENTO,
      { chave: "descricao", descricao: "Descrição da cobrança", exemplo: "Parcela 2/6 - Informática Básica" },
      P_LINK_BOLETO,
      { chave: "codigo_pix", descricao: "Link/código para pagar via Pix", exemplo: "https://asaas.com/i/abc123" },
    ],
  },
  cobranca_atrasada_d1: {
    id: "cobranca_atrasada_d1",
    nome: "Cobrança atrasada — 1 a 2 dias",
    gatilho: "Cron diário (verificar-atrasos), quando a parcela completa 1 dia de atraso.",
    padrao: "Olá, {nome}, notamos que sua parcela de {valor} (vencimento {vencimento}) ainda não foi paga. Segue o link para pagamento: {link_boleto}",
    placeholders: [P_NOME, P_VALOR, P_VENCIMENTO, P_DIAS_ATRASO, P_LINK_BOLETO],
  },
  cobranca_atrasada_d3: {
    id: "cobranca_atrasada_d3",
    nome: "Cobrança atrasada — 3 a 6 dias",
    gatilho: "Cron diário (verificar-atrasos), quando a parcela completa 3 dias de atraso.",
    padrao: "Olá, {nome}, sua parcela de {valor} está atrasada há {dias_atraso} dias (venceu em {vencimento}). Regularize para evitar transtornos: {link_boleto}",
    placeholders: [P_NOME, P_VALOR, P_VENCIMENTO, P_DIAS_ATRASO, P_LINK_BOLETO],
  },
  cobranca_atrasada_d7: {
    id: "cobranca_atrasada_d7",
    nome: "Cobrança atrasada — 7 a 14 dias",
    gatilho: "Cron diário (verificar-atrasos), quando a parcela completa 7 dias de atraso.",
    padrao: "{nome}, sua parcela de {valor} está em atraso há {dias_atraso} dias. Por favor, regularize o quanto antes: {link_boleto}",
    placeholders: [P_NOME, P_VALOR, P_VENCIMENTO, P_DIAS_ATRASO, P_LINK_BOLETO],
  },
  cobranca_atrasada_d15: {
    id: "cobranca_atrasada_d15",
    nome: "Cobrança atrasada — 15+ dias",
    gatilho: "Cron diário (verificar-atrasos), quando a parcela completa 15 dias de atraso.",
    padrao: "{nome}, sua parcela de {valor} está atrasada há {dias_atraso} dias. Entre em contato conosco urgentemente para evitar a suspensão do seu acesso: {link_boleto}",
    placeholders: [P_NOME, P_VALOR, P_VENCIMENTO, P_DIAS_ATRASO, P_LINK_BOLETO],
  },
  lead_followup: {
    id: "lead_followup",
    nome: "Follow-up de lead",
    gatilho: "Cron diário (followup-leads), para leads com próxima ação vencida.",
    padrao: "Olá, {nome}! 😊 Ainda podemos te ajudar com {curso_interesse} na {nome_escola}. Podemos conversar?",
    placeholders: [
      P_NOME,
      { chave: "curso_interesse", descricao: "Curso de interesse do lead", exemplo: "Informática Básica" },
      P_NOME_ESCOLA,
      { chave: "tentativa", descricao: "Número da tentativa de contato", exemplo: "2" },
    ],
  },
};

// Chaves {placeholder} usadas num texto.
export function placeholdersUsados(modelo: string): string[] {
  return Array.from(new Set(Array.from(modelo.matchAll(/\{(\w+)\}/g), (m) => m[1])));
}

// Chaves usadas no texto que NÃO estão na lista permitida (typo do admin).
export function placeholdersDesconhecidos(modelo: string, permitidos: string[]): string[] {
  return placeholdersUsados(modelo).filter((chave) => !permitidos.includes(chave));
}

// Troca cada {chave} pelo valor informado; chave sem valor correspondente fica como está (fica
// visível no texto final, mais fácil de notar um envio com variável faltando do que sumir
// silenciosamente).
export function renderizarTemplateWhatsapp(modelo: string, valores: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? valores[chave] : inteiro));
}

export function valoresDeExemplo(placeholders: WhatsappPlaceholder[]): Record<string, string> {
  return Object.fromEntries(placeholders.map((p) => [p.chave, p.exemplo]));
}

