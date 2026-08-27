import { z } from "zod";
import { FORMAS_PAGAMENTO, type FormaPagamento } from "@/lib/matriculas/schema";

export const PARCELA_STATUSES = ["pendente", "pago", "atrasado", "cancelado", "estornado"] as const;
export type ParcelaStatus = (typeof PARCELA_STATUSES)[number];

export const PARCELA_STATUS_LABELS: Record<ParcelaStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

// Mesmo padrão de cores fixas via className usado em MATRICULA_STATUS_BADGE_CLASS
// (src/lib/matriculas/schema.ts) e afins.
export const PARCELA_STATUS_BADGE_CLASS: Record<ParcelaStatus, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  pago: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  atrasado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  cancelado: "bg-muted text-muted-foreground",
  estornado: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
};

export const GASTO_CATEGORIAS = [
  "aluguel",
  "material",
  "salario",
  "marketing",
  "manutencao",
  "outro",
] as const;
export type GastoCategoria = (typeof GASTO_CATEGORIAS)[number];

export const GASTO_CATEGORIA_LABELS: Record<GastoCategoria, string> = {
  aluguel: "Aluguel",
  material: "Material",
  salario: "Salário",
  marketing: "Marketing",
  manutencao: "Manutenção",
  outro: "Outro",
};

export const PAGAMENTO_AVULSO_TIPOS = ["receita", "taxa", "outro"] as const;
export type PagamentoAvulsoTipo = (typeof PAGAMENTO_AVULSO_TIPOS)[number];
export const PAGAMENTO_AVULSO_TIPO_LABELS: Record<PagamentoAvulsoTipo, string> = {
  receita: "Receita",
  taxa: "Taxa",
  outro: "Outro",
};

export const FORMAS_PAGAMENTO_AVULSO = ["boleto", "pix", "cartao", "dinheiro", "outro"] as const;
export type FormaPagamentoAvulso = (typeof FORMAS_PAGAMENTO_AVULSO)[number];
export const FORMA_PAGAMENTO_AVULSO_LABELS: Record<FormaPagamentoAvulso, string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export type Parcela = {
  id: string;
  matricula_id: string;
  aluno_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ParcelaStatus;
  forma_pagamento: FormaPagamento | null;
  asaas_payment_id: string | null;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  asaas_status: string | null;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PagamentoAvulso = {
  id: string;
  descricao: string;
  valor: number;
  data_pagamento: string;
  tipo: PagamentoAvulsoTipo;
  forma_pagamento: FormaPagamentoAvulso | null;
  aluno_id: string | null;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Gasto = {
  id: string;
  descricao: string;
  categoria: GastoCategoria;
  valor: number;
  data_gasto: string;
  forma_pagamento: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  recorrente: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const parcelaFormSchema = z.object({
  matricula_id: z.uuid({ error: "Selecione a matrícula." }),
  numero_parcela: z.number().int().min(1),
  valor: z.number().min(0.01, { error: "Informe um valor válido." }),
  data_vencimento: z.string().min(1, { error: "Informe a data de vencimento." }),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO).nullable(),
  observacoes: z.string().trim().max(1000, { error: "Observações muito longas." }).optional(),
});

export type ParcelaFormValues = z.infer<typeof parcelaFormSchema>;

export const pagamentoAvulsoFormSchema = z.object({
  descricao: z.string().trim().min(1, { error: "Informe a descrição." }),
  valor: z.number().min(0.01, { error: "Informe um valor válido." }),
  data_pagamento: z.string().min(1, { error: "Informe a data do pagamento." }),
  tipo: z.enum(PAGAMENTO_AVULSO_TIPOS, { error: "Selecione o tipo." }),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO_AVULSO).nullable(),
  aluno_id: z.uuid().nullable().optional(),
  observacoes: z.string().trim().max(1000, { error: "Observações muito longas." }).optional(),
});

export type PagamentoAvulsoFormValues = z.infer<typeof pagamentoAvulsoFormSchema>;

export const gastoFormSchema = z.object({
  descricao: z.string().trim().min(1, { error: "Informe a descrição." }),
  categoria: z.enum(GASTO_CATEGORIAS, { error: "Selecione a categoria." }),
  valor: z.number().min(0.01, { error: "Informe um valor válido." }),
  data_gasto: z.string().min(1, { error: "Informe a data do gasto." }),
  forma_pagamento: z.string().trim().max(100).optional(),
  observacoes: z.string().trim().max(1000, { error: "Observações muito longas." }).optional(),
  recorrente: z.boolean(),
});

export type GastoFormValues = z.infer<typeof gastoFormSchema>;
