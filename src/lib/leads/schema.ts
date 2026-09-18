import { z } from "zod";

export const LEAD_ORIGENS = ["indicacao", "redes_sociais", "google", "panfleto", "campanha", "outro"] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export const LEAD_ORIGEM_LABELS: Record<LeadOrigem, string> = {
  indicacao: "Indicação",
  redes_sociais: "Redes sociais",
  google: "Google",
  panfleto: "Panfleto",
  campanha: "Página de campanha",
  outro: "Outro",
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
  curso_id: string;
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
export const KANBAN_COLUNAS = ["novo", "contato", "negociacao", "matriculado", "perdido"] as const;
export type KanbanColuna = (typeof KANBAN_COLUNAS)[number];

export const KANBAN_COLUNA_LABELS: Record<KanbanColuna, string> = {
  novo: "🆕 Novo",
  contato: "📞 Em contato",
  negociacao: "🤝 Negociação",
  matriculado: "✅ Matriculado",
  perdido: "❌ Perdido",
};

// Azul/âmbar/roxo/verde/vermelho-cinza, mesmo padrão de cores fixas via
// className usado em CAMPANHA_STATUS_BADGE_CLASS.
export const KANBAN_COLUNA_COR_CLASS: Record<KanbanColuna, string> = {
  novo: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  contato: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  negociacao: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
  matriculado: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  perdido: "bg-muted text-muted-foreground",
};

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

export const FOLLOWUP_AUTOMATICO_LIMITE = 7;

export const kanbanColunaUpdateSchema = z.object({
  kanban_coluna: z.enum(KANBAN_COLUNAS, { error: "Coluna inválida." }),
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
  telefone: z
    .string({ error: "Informe o telefone." })
    .trim()
    .min(1, { error: "Informe o telefone." })
    .max(30, { error: "Telefone inválido." }),
  curso_id: z.uuid({ error: "Selecione o curso de interesse." }),
  origem: z.enum(LEAD_ORIGENS, { error: "Selecione como ficou sabendo." }),
  observacoes: z
    .string()
    .trim()
    .max(2000, { error: "As observações podem ter no máximo 2000 caracteres." })
    .optional()
    .transform((v) => v || undefined),
});
export type LeadFormValues = z.infer<typeof leadFormSchema>;

// Mesmas regras do cadastro manual — o formulário público não pede menos
// nem mais dados que o admin pediria digitando à mão.
export const leadPublicoFormSchema = leadFormSchema;

export const leadStatusUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES, { error: "Status inválido." }),
});
