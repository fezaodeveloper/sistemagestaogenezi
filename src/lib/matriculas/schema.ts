import { z } from "zod";

// Enum real do banco (matricula_status): 'transferida' segue existindo por
// causa de dados históricos (ver 20260908300000_matricula_status_enum.sql),
// mesmo não sendo mais oferecida como opção nova — no código ela é tratada
// como um alias visual de 'inativa' (mesma cor/estilo).
export const MATRICULA_STATUSES = [
  "ativa",
  "inativa",
  "concluida",
  "cancelada",
  "transferida",
] as const;

export const MATRICULA_STATUS_LABELS: Record<(typeof MATRICULA_STATUSES)[number], string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
  transferida: "Transferida",
};

// Mesmo padrão de cores fixas via className usado em STATUS_ALUNO_BADGE_CLASS
// (src/lib/alunos/schema.ts) e CURSO_STATUS_BADGE_CLASS (src/lib/cursos/schema.ts).
// 'transferida' usa o mesmo amarelo de 'inativa' (alias visual).
export const MATRICULA_STATUS_BADGE_CLASS: Record<(typeof MATRICULA_STATUSES)[number], string> = {
  ativa: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  concluida: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  inativa: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  transferida: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  cancelada: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export const matriculaFormSchema = z.object({
  turma_id: z.uuid({ error: "Selecione a turma." }),
  data_matricula: z.string().min(1, { error: "Informe a data da matrícula." }),
});

export type MatriculaFormValues = z.infer<typeof matriculaFormSchema>;

// Valores batem com o CHECK constraint de matriculas.desconto_tipo
// (20260908200000_matriculas_campos_expandidos.sql) — "sem_bolsa" no banco,
// rótulo "Sem desconto" na tela (nomes não precisam bater).
export const DESCONTO_TIPOS = [
  "sem_bolsa",
  "desconto_avista",
  "indicacao",
  "bolsa_social",
  "outro",
] as const;
export type DescontoTipo = (typeof DESCONTO_TIPOS)[number];
export const DESCONTO_TIPO_LABELS: Record<DescontoTipo, string> = {
  sem_bolsa: "Sem desconto",
  desconto_avista: "Desconto à vista",
  indicacao: "Indicação",
  bolsa_social: "Bolsa social",
  outro: "Outro",
};

export const DESCONTO_FORMATOS = ["porcentagem", "reais"] as const;
export type DescontoFormato = (typeof DESCONTO_FORMATOS)[number];
export const DESCONTO_FORMATO_LABELS: Record<DescontoFormato, string> = {
  porcentagem: "Porcentagem (%)",
  reais: "Valor fixo (R$)",
};

export const FORMAS_PAGAMENTO = ["boleto", "pix", "cartao", "avista", "outro"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];
export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
  avista: "À vista",
  outro: "Outro",
};

export const NUM_PARCELAS_OPTIONS = Array.from({ length: 12 }, (_, indice) => indice + 1);

// Status permitido na criação pelo wizard — "concluida"/"transferida" só
// fazem sentido depois, via edição/gestão do ciclo de vida da matrícula.
export const STATUS_INICIAL_MATRICULA = ["ativa", "inativa"] as const;

export const matriculaWizardSchema = z.object({
  aluno_id: z.uuid({ error: "Selecione o aluno." }),
  turma_id: z.uuid({ error: "Selecione a turma." }),
  valor_original: z.number().min(0).nullable(),
  desconto_tipo: z.enum(DESCONTO_TIPOS),
  desconto_formato: z.enum(DESCONTO_FORMATOS).nullable(),
  desconto_valor: z.number().min(0).nullable(),
  valor_final: z.number().min(0).nullable(),
  num_parcelas: z.number().int().min(1).max(12),
  valor_parcela: z.number().min(0).nullable(),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO, { error: "Selecione a forma de pagamento." }),
  taxa_cartao: z.number().min(0).max(10).nullable(),
  data_primeira_mensalidade: z
    .string()
    .min(1, { error: "Informe a data da primeira mensalidade." }),
  data_inicio: z.string().min(1, { error: "Informe a data de início." }),
  previsao_conclusao: z.string().nullable(),
  farda_entregue: z.boolean(),
  apostila_entregue: z.boolean(),
  kit_entregue: z.boolean(),
  observacoes: z
    .string()
    .trim()
    .max(2000, { error: "Observações muito longas." })
    .optional(),
  status: z.enum(STATUS_INICIAL_MATRICULA, { error: "Selecione o status inicial." }),
});

export type MatriculaWizardInput = z.infer<typeof matriculaWizardSchema>;

export type Matricula = {
  id: string;
  aluno_id: string;
  turma_id: string;
  data_matricula: string;
  data_expiracao: string;
  status: (typeof MATRICULA_STATUSES)[number];
  valor_original: number | null;
  desconto_tipo: DescontoTipo | null;
  desconto_formato: DescontoFormato | null;
  desconto_valor: number | null;
  valor_final: number | null;
  num_parcelas: number | null;
  valor_parcela: number | null;
  forma_pagamento: FormaPagamento | null;
  taxa_cartao: number | null;
  data_primeira_mensalidade: string | null;
  data_inicio: string | null;
  previsao_conclusao: string | null;
  farda_entregue: boolean;
  apostila_entregue: boolean;
  kit_entregue: boolean;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MatriculaWithTurma = Matricula & { turmas: { nome: string } | null };
