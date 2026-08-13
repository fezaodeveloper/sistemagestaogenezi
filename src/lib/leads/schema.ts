import { z } from "zod";

export const LEAD_ORIGENS = ["indicacao", "redes_sociais", "google", "panfleto", "outro"] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export const LEAD_ORIGEM_LABELS: Record<LeadOrigem, string> = {
  indicacao: "Indicação",
  redes_sociais: "Redes sociais",
  google: "Google",
  panfleto: "Panfleto",
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
  created_at: string;
  updated_at: string;
};

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
