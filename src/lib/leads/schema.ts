import { z } from "zod";

// 'agendamento' (TAREFA CRM 2.2) exige a migration 20261030300000_integracoes_comercial.sql
// aplicada (ALTER TYPE ... ADD VALUE) — mesmo padrão já usado pra adicionar 'campanha'.
export const LEAD_ORIGENS = [
  "indicacao",
  "redes_sociais",
  "google",
  "panfleto",
  "campanha",
  "agendamento",
  "outro",
] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export const LEAD_ORIGEM_LABELS: Record<LeadOrigem, string> = {
  indicacao: "Indicação",
  redes_sociais: "Redes sociais",
  google: "Google",
  panfleto: "Panfleto",
  campanha: "Página de campanha",
  agendamento: "Agendamento público",
  outro: "Outro",
};

// Cores do badge de origem (TAREFA pedia "Instagram=roxo, Facebook=azul..." — esses dois valores
// não existem no enum lead_origem, que só tem indicacao/redes_sociais/google/panfleto/campanha/
// agendamento/outro, ver AUDITORIA; "redes_sociais" já cobre Instagram/Facebook/etc. de forma
// genérica).
export const LEAD_ORIGEM_BADGE_CLASS: Record<LeadOrigem, string> = {
  indicacao: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  redes_sociais: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  google: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  panfleto: "bg-orange-500/10 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  campanha: "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  agendamento: "bg-teal-500/10 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  outro: "bg-muted text-muted-foreground",
};

export const LEAD_STATUSES = [
  "novo",
  "contatado",
  "aluno_ativo",
  "ex_aluno",
  "desistente",
  "descartado",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  aluno_ativo: "Aluno ativo",
  ex_aluno: "Ex-aluno",
  desistente: "Desistente",
  descartado: "Descartado",
};

// aluno_ativo/ex_aluno/desistente normalmente são setados só pelas
// triggers de sincronização (ver migration) — continuam disponíveis no
// Select manual do admin como escape hatch (ex.: dado importado antes
// desta fase existir, telefone que não bateu na sincronização), mas a
// UI sinaliza que são "normalmente automáticos".
export const LEAD_STATUSES_AUTOMATICOS: LeadStatus[] = ["aluno_ativo", "ex_aluno", "desistente"];

export type Lead = {
  id: string;
  nome: string;
  telefone: string;
  // TAREFA CRM 2.2 — virou nullable (migration 20261030300000): leads vindos de página de
  // campanha sem curso vinculado precisam existir mesmo sem curso_id.
  curso_id: string | null;
  origem: LeadOrigem;
  status: LeadStatus;
  observacoes: string | null;
  kanban_coluna: KanbanColuna;
  temperatura: Temperatura | null;
  proxima_acao: string | null;
  notas: string | null;
  campanha_origem: string | null;
  followup_count: number;
  ultimo_followup: string | null;
  // CRM 2.1 (TAREFA) — proxima_acao (date, acima) continua existindo e editável no drawer;
  // proximo_contato (timestamptz) é o campo novo, com hora, usado pelo card "Retornos
  // pendentes" e pelo datetime-local do formulário. Os dois convivem por ora — ver resumo.
  whatsapp: string | null;
  email: string | null;
  campanha_id: string | null;
  responsavel_id: string | null;
  proximo_contato: string | null;
  motivo_perda: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
};

// ===== CRM Kanban (roadmap, item 3) =====
//
// Coluna do Kanban é um estágio de negociação manual do admin — deliberadamente
// separado de `status` (que continua só sincronizado automaticamente pelas
// triggers de matrícula/certificado, ver 20260902100000_create_leads.sql).
// "Matricular" no drawer só move o card pra coluna matriculado; a matrícula de
// verdade continua sendo feita no wizard (/admin/matriculas/nova).
//
// As colunas são configuráveis pelo admin e vivem na tabela `kanban_colunas`
// (ver 20260918500000_kanban_colunas.sql). `leads.kanban_coluna` guarda o `id`
// da coluna (texto): as 5 colunas originais mantêm os ids antigos ("novo",
// "contato", ...), então nenhum lead precisou de migração de dados.
export type KanbanColuna = string;

export type KanbanColunaConfig = {
  id: string;
  nome: string;
  ordem: number;
  // Hex "#rrggbb" — usado inline (não dá pra gerar classe Tailwind pra uma
  // cor escolhida em runtime).
  cor: string;
};

// Espelha o seed da migration. Só serve de fallback de leitura se a tabela
// ainda não existir/estiver vazia (ver getKanbanColunas) — a fonte da
// verdade é o banco.
export const KANBAN_COLUNAS_PADRAO: KanbanColunaConfig[] = [
  { id: "novo", nome: "🆕 Novo", ordem: 1, cor: "#3b82f6" },
  { id: "contato", nome: "📞 Em contato", ordem: 2, cor: "#f59e0b" },
  { id: "negociacao", nome: "🤝 Negociação", ordem: 3, cor: "#a855f7" },
  { id: "matriculado", nome: "✅ Matriculado", ordem: 4, cor: "#22c55e" },
  { id: "perdido", nome: "❌ Perdido", ordem: 5, cor: "#6b7280" },
];

// Colunas com significado fixo no app — não podem ser apagadas (renomear
// pode): "novo" é o default de todo lead novo (coluna do banco + captação
// pública) e "matriculado" é o destino do botão "Matricular".
export const KANBAN_COLUNAS_PROTEGIDAS: readonly string[] = ["novo", "matriculado"];

// Colunas onde "próxima ação vencida" não faz sentido (negócio já resolvido).
export const KANBAN_COLUNAS_ENCERRADAS: readonly string[] = ["matriculado", "perdido"];

export const kanbanColunaNomeSchema = z
  .string({ error: "Informe o nome da coluna." })
  .trim()
  .min(1, { error: "Informe o nome da coluna." })
  .max(40, { error: "Máximo de 40 caracteres." });

export const kanbanColunaCorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." });

// TAREFA CRM 2.2 (agendamento público) — busca por NOME (não existe uma coluna "Visita/Agendado"
// no seed atual, ver AUDITORIA: só novo/contato/negociacao/matriculado/perdido). Sem essa coluna,
// cai em "novo" pra lead novo, ou mantém a coluna atual pra lead já existente (null = "não mover").
export function encontrarColunaVisitaAgendado(colunas: KanbanColunaConfig[]): KanbanColunaConfig | null {
  return colunas.find((c) => /visita|agendad/i.test(c.nome)) ?? null;
}

// Cabeçalho da coluna: fundo com a cor a ~10% de opacidade + texto na cor.
export function kanbanColunaEstilo(cor: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `${cor}1a`, color: cor };
}

export const TEMPERATURAS = ["quente", "morno", "frio"] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];

export const TEMPERATURA_LABELS: Record<Temperatura, string> = {
  quente: "🔥 Quente",
  morno: "🌡️ Morno",
  frio: "🧊 Frio",
};

export const TEMPERATURA_BADGE_CLASS: Record<Temperatura, string> = {
  quente: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  morno: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  frio: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
};

// Cor do badge de "campanha de origem" no card do Kanban — determinística a
// partir do nome (mesma campanha sempre com a mesma cor), sem precisar de
// coluna de cor nem de tabela de campanhas. Classes literais pro Tailwind
// enxergar todas na hora do build.
const CAMPANHA_BADGE_CLASSES = [
  "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "bg-pink-500/10 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  "bg-orange-500/10 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  "bg-lime-500/10 text-lime-700 dark:bg-lime-500/15 dark:text-lime-400",
  "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
] as const;

export function campanhaBadgeClass(campanha: string): string {
  let hash = 0;
  for (const char of campanha) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CAMPANHA_BADGE_CLASSES[hash % CAMPANHA_BADGE_CLASSES.length];
}

export const FOLLOWUP_AUTOMATICO_LIMITE = 7;

// TAREFA: mover um lead pra uma coluna "Perdido" exige motivo_perda preenchido. Por NOME
// (case-insensitive), não por id — admin pode criar uma coluna própria chamada "Perdido" com
// outro id, e ainda assim deve exigir o motivo; a coluna padrão (id "perdido") também bate aqui
// porque o nome dela ("❌ Perdido") contém a palavra.
export function colunaExigeMotivoPerda(nomeColuna: string): boolean {
  return nomeColuna.toLowerCase().includes("perdido");
}

export const kanbanColunaUpdateSchema = z.object({
  kanban_coluna: z.string({ error: "Coluna inválida." }).trim().min(1, { error: "Coluna inválida." }).max(100),
  // Só exigido pela Server Action quando a coluna de destino é "Perdido" (ver
  // colunaExigeMotivoPerda) — por isso opcional aqui, a obrigatoriedade é condicional.
  motivo_perda: z
    .string()
    .trim()
    .max(500, { error: "Máximo de 500 caracteres." })
    .optional()
    .transform((v) => v || undefined),
});

export const leadCrmUpdateSchema = z.object({
  temperatura: z.enum(TEMPERATURAS, { error: "Temperatura inválida." }),
  proxima_acao: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  notas: z
    .string()
    .trim()
    .max(5000, { error: "As notas podem ter no máximo 5000 caracteres." })
    .optional()
    .transform((v) => v || undefined),
  campanha_origem: z
    .string()
    .trim()
    .max(200, { error: "Máximo de 200 caracteres." })
    .optional()
    .transform((v) => v || undefined),
  observacoes: z
    .string()
    .trim()
    .max(2000, { error: "Máximo de 2000 caracteres." })
    .optional()
    .transform((v) => v || undefined),
  // Curso de interesse (combobox do drawer) — só vem quando o admin trocou.
  curso_id: z.uuid({ error: "Curso inválido." }).optional(),
  // Data do último contato (YYYY-MM-DD). Ausente = não mexer; "" = limpar.
  ultimo_contato: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data do último contato inválida." })])
    .optional(),
  // CRM 2.1 (TAREFA) — "sempre enviados" igual temperatura/notas/campanha_origem acima (o drawer
  // manda o estado local inteiro a cada Salvar, não um patch parcial) — por isso todos
  // transformam "" em undefined aqui, e a action usa `?? null` sem checar `!== undefined`.
  // Diferente de curso_id/ultimo_contato (abaixo), que são de fato parciais.
  whatsapp: z
    .string()
    .trim()
    .max(30, { error: "WhatsApp inválido." })
    .optional()
    .transform((v) => v || undefined),
  email: z
    .union([z.literal(""), z.email({ error: "E-mail inválido." })])
    .optional()
    .transform((v) => v || undefined),
  campanha_id: z
    .union([z.literal(""), z.uuid({ error: "Campanha inválida." })])
    .optional()
    .transform((v) => v || undefined),
  responsavel_id: z
    .union([z.literal(""), z.uuid({ error: "Responsável inválido." })])
    .optional()
    .transform((v) => v || undefined),
  // Datetime-local (YYYY-MM-DDTHH:mm).
  proximo_contato: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Data/hora inválida." })])
    .optional()
    .transform((v) => v || undefined),
});
export type LeadCrmUpdateValues = z.infer<typeof leadCrmUpdateSchema>;

export const registrarFollowupSchema = z.object({
  nota: z
    .string({ error: "Escreva uma nota sobre o follow-up." })
    .trim()
    .min(1, { error: "Escreva uma nota sobre o follow-up." })
    .max(1000, { error: "A nota pode ter no máximo 1000 caracteres." }),
});

export const leadFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome." })
    .trim()
    .min(1, { error: "Informe o nome." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  // Rotulado "WhatsApp" na UI (TAREFA) — mesma coluna `telefone` de sempre (NOT NULL, com índice
  // único parcial de dedup por telefone+curso, ver migration original). createLead/updateLead
  // gravam esse mesmo valor também em leads.whatsapp (coluna nova, nullable, só pra consulta
  // direta sem precisar ler `telefone` com nome enganoso) — não duas colunas independentes.
  telefone: z
    .string({ error: "Informe o WhatsApp." })
    .trim()
    .min(1, { error: "Informe o WhatsApp." })
    .max(30, { error: "WhatsApp inválido." }),
  curso_id: z.uuid({ error: "Selecione o curso de interesse." }),
  origem: z.enum(LEAD_ORIGENS, { error: "Selecione como ficou sabendo." }),
  observacoes: z
    .string()
    .trim()
    .max(2000, { error: "As observações podem ter no máximo 2000 caracteres." })
    .optional()
    .transform((v) => v || undefined),
  // CRM 2.1 (TAREFA) — todos opcionais: o formulário PÚBLICO (/captacao) reaproveita este mesmo
  // schema (leadPublicoFormSchema = leadFormSchema) e nunca envia esses campos.
  email: z.union([z.literal(""), z.email({ error: "E-mail inválido." })]).optional(),
  campanha_id: z.union([z.literal(""), z.uuid({ error: "Campanha inválida." })]).optional(),
  responsavel_id: z.union([z.literal(""), z.uuid({ error: "Responsável inválido." })]).optional(),
  proximo_contato: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Data/hora inválida." })])
    .optional(),
});
export type LeadFormValues = z.infer<typeof leadFormSchema>;

// Mesmas regras do cadastro manual — o formulário público não pede menos
// nem mais dados que o admin pediria digitando à mão.
export const leadPublicoFormSchema = leadFormSchema;

export const leadStatusUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES, { error: "Status inválido." }),
});

// ===== Formatação / CRM =====

// Fuso fixo (Brasília) nas datas dos leads: o mesmo texto sai no server e no
// client (senão a data poderia divergir perto da meia-noite e gerar
// hydration mismatch) e "hoje" é o dia do admin, não o dia em UTC.
const FUSO_LEADS = "America/Sao_Paulo";

export function formatarDataLead(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO_LEADS });
}

// "18/09/2026 às 14:32" (horário de Brasília).
export function formatarDataHoraLead(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString("pt-BR", { timeZone: FUSO_LEADS });
  const hora = data.toLocaleTimeString("pt-BR", { timeZone: FUSO_LEADS, hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

// "Quinta-feira, 18/09/2026 às 14:32" (horário de Brasília).
export function formatarDataHoraCompletaLead(iso: string): string {
  const semana = new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO_LEADS, weekday: "long" });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${formatarDataHoraLead(iso)}`;
}

// "YYYY-MM-DD" pra <input type="date">.
export function dataLeadParaInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: FUSO_LEADS });
}

// "YYYY-MM-DDTHH:mm" pra <input type="datetime-local"> (TAREFA: campo proximo_contato).
export function dataHoraLeadParaInput(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  const diaLocal = data.toLocaleDateString("en-CA", { timeZone: FUSO_LEADS });
  const horaLocal = data.toLocaleTimeString("en-GB", { timeZone: FUSO_LEADS, hour: "2-digit", minute: "2-digit" });
  return `${diaLocal}T${horaLocal}`;
}

// Inverso: valor de <input type="datetime-local"> (sem timezone) interpretado como horário de
// Brasília, de volta pra ISO/UTC — mesma ideia de "meio-dia de Brasília" já usada em
// atualizarLeadCrm pra ultimo_contato, mas preservando a hora exata em vez de fixar meio-dia.
export function dataHoraInputParaIso(valor: string): string {
  return new Date(`${valor}:00-03:00`).toISOString();
}

// "Há X dia(s) no funil" (TAREFA: cabeçalho do drawer) — desde created_at, sempre >= 0.
export function diasNoFunil(createdAtIso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAtIso).getTime()) / 86400000));
}

// ===== Histórico de atividades (tabela lead_historico, TAREFA CRM 2.1) =====

export const LEAD_HISTORICO_TIPOS = [
  "criacao",
  "status_alterado",
  "coluna_alterada",
  "anotacao",
  "agendamento",
  "whatsapp",
  "matricula",
] as const;
export type LeadHistoricoTipo = (typeof LEAD_HISTORICO_TIPOS)[number];

export const LEAD_HISTORICO_ICONES: Record<LeadHistoricoTipo, string> = {
  criacao: "🆕",
  status_alterado: "🔄",
  coluna_alterada: "🔄",
  anotacao: "✏️",
  agendamento: "📅",
  whatsapp: "💬",
  matricula: "🎓",
};

export type LeadHistoricoEntrada = {
  id: string;
  tipo: LeadHistoricoTipo;
  descricao: string;
  colunaAnterior: string | null;
  colunaNova: string | null;
  usuarioNome: string | null;
  createdAt: string;
};

// "há 5 minutos" / "há 3 dias" etc. — granularidade suficiente pra uma timeline de atividades,
// sem precisar de uma lib de i18n relativa só pra isso.
export function formatarTempoRelativoLead(iso: string): string {
  const segundos = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (segundos < 60) return "agora mesmo";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} minuto${minutos === 1 ? "" : "s"}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} hora${horas === 1 ? "" : "s"}`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
}

// "Histórico de follow-ups" não tem tabela própria (a migration só adicionou
// um campo `notas` de texto livre em leads) — cada follow-up automático
// (cron) ou manual (botão do drawer) vira uma linha "[data hora] texto" no
// topo de notas, mais recente primeiro.
export function extrairHistoricoFollowups(notas: string | null): string[] {
  if (!notas) return [];
  return notas.split("\n").filter((linha) => /^\[\d{2}\/\d{2}\/\d{4}/.test(linha));
}

// Total de follow-ups realizados (automáticos + manuais). `followup_count`
// só conta os automáticos (é o contador do limite de 7 do cron), então o
// total vem das entradas do histórico.
export function contarFollowups(notas: string | null): number {
  return extrairHistoricoFollowups(notas).length;
}
