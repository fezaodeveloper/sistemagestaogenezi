import { z } from "zod";

export const ESTOQUE_CATEGORIAS = ["apostila", "farda", "kit", "material", "outro"] as const;
export type EstoqueCategoria = (typeof ESTOQUE_CATEGORIAS)[number];

export const ESTOQUE_CATEGORIA_LABELS: Record<EstoqueCategoria, string> = {
  apostila: "Apostila",
  farda: "Farda",
  kit: "Kit",
  material: "Material",
  outro: "Outro",
};

// Mesmo padrão de cores fixas via className usado em TREINAMENTO_CATEGORIA_BADGE_CLASS
// (src/lib/treinamentos/schema.ts) e afins.
export const ESTOQUE_CATEGORIA_BADGE_CLASS: Record<EstoqueCategoria, string> = {
  apostila: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  farda: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  kit: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
  material: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  outro: "bg-muted text-muted-foreground",
};

export const ESTOQUE_MOVIMENTACAO_TIPOS = ["entrada", "saida", "ajuste"] as const;
export type EstoqueMovimentacaoTipo = (typeof ESTOQUE_MOVIMENTACAO_TIPOS)[number];

export const ESTOQUE_MOVIMENTACAO_TIPO_LABELS: Record<EstoqueMovimentacaoTipo, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

export const estoqueItemFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do item." })
    .trim()
    .min(1, { error: "Informe o nome do item." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  categoria: z.enum(ESTOQUE_CATEGORIAS, { error: "Selecione a categoria." }),
  quantidade_atual: z.coerce
    .number({ error: "Informe a quantidade atual." })
    .int({ error: "Deve ser um número inteiro." })
    .min(0, { error: "Não pode ser negativo." }),
  quantidade_minima: z.coerce
    .number({ error: "Informe a quantidade mínima." })
    .int({ error: "Deve ser um número inteiro." })
    .min(0, { error: "Não pode ser negativo." }),
  unidade: z
    .string({ error: "Informe a unidade." })
    .trim()
    .min(1, { error: "Informe a unidade." })
    .max(50, { error: "Máximo de 50 caracteres." }),
  observacoes: z.string().trim().max(1000, { error: "Máximo de 1000 caracteres." }).optional(),
});

export type EstoqueItemFormValues = z.infer<typeof estoqueItemFormSchema>;

// "ajuste" define quantidade_atual como o valor absoluto informado
// (correção após contagem física); "entrada"/"saida" somam/subtraem do
// valor atual.
export const estoqueMovimentacaoFormSchema = z.object({
  tipo: z.enum(ESTOQUE_MOVIMENTACAO_TIPOS, { error: "Selecione o tipo." }),
  quantidade: z.coerce
    .number({ error: "Informe a quantidade." })
    .int({ error: "Deve ser um número inteiro." })
    .min(0, { error: "Não pode ser negativo." }),
  motivo: z.string().trim().max(500, { error: "Máximo de 500 caracteres." }).optional(),
});

export type EstoqueMovimentacaoFormValues = z.infer<typeof estoqueMovimentacaoFormSchema>;

export type EstoqueItem = {
  id: string;
  nome: string;
  categoria: EstoqueCategoria;
  quantidade_atual: number;
  quantidade_minima: number;
  unidade: string;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EstoqueMovimentacao = {
  id: string;
  item_id: string;
  tipo: EstoqueMovimentacaoTipo;
  quantidade: number;
  motivo: string | null;
  referencia_id: string | null;
  aluno_id: string | null;
  aluno_nome_cache: string | null;
  created_by: string;
  created_at: string;
};

// Saída de estoque vinculada a um aluno (entrega) — usada na tela
// /admin/estoque/entregas. aluno_nome_cache (não o join com alunos) é a
// fonte de verdade pro nome exibido, já que sobrevive à exclusão do aluno
// (aluno_id vira null via on delete set null).
export type EstoqueEntrega = EstoqueMovimentacao & {
  estoque_itens: { nome: string; categoria: EstoqueCategoria } | null;
};
