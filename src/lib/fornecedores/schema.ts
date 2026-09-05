import { z } from "zod";

export const FORNECEDOR_CATEGORIAS = [
  "grafica",
  "fardas",
  "tecnologia",
  "material_escritorio",
  "limpeza",
  "manutencao",
  "marketing",
  "outro",
] as const;
export type FornecedorCategoria = (typeof FORNECEDOR_CATEGORIAS)[number];

export const FORNECEDOR_CATEGORIA_LABELS: Record<FornecedorCategoria, string> = {
  grafica: "Gráfica / Apostilas",
  fardas: "Fardas / Uniformes",
  tecnologia: "Tecnologia / TI",
  material_escritorio: "Material de Escritório",
  limpeza: "Limpeza / Conservação",
  manutencao: "Manutenção",
  marketing: "Marketing",
  outro: "Outro",
};

// Mesmo padrão de cores fixas via className usado em TREINAMENTO_CATEGORIA_BADGE_CLASS
// (src/lib/treinamentos/schema.ts) e afins.
export const FORNECEDOR_CATEGORIA_BADGE_CLASS: Record<FornecedorCategoria, string> = {
  grafica: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  fardas: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  tecnologia: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
  material_escritorio: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  limpeza: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  manutencao: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  marketing: "bg-pink-500/10 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
  outro: "bg-muted text-muted-foreground",
};

export const fornecedorFormSchema = z.object({
  nome_contato: z
    .string({ error: "Informe o nome do contato." })
    .trim()
    .min(1, { error: "Informe o nome do contato." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  nome_empresa: z
    .string({ error: "Informe o nome da empresa." })
    .trim()
    .min(1, { error: "Informe o nome da empresa." })
    .max(200, { error: "Máximo de 200 caracteres." }),
  categoria: z.enum(FORNECEDOR_CATEGORIAS, { error: "Selecione a categoria." }),
  telefone: z.string().trim().max(20, { error: "Máximo de 20 caracteres." }).optional(),
  email: z.email({ error: "Informe um e-mail válido." }).optional(),
  whatsapp: z.string().trim().max(20, { error: "Máximo de 20 caracteres." }).optional(),
  site: z.string().trim().max(300, { error: "Máximo de 300 caracteres." }).optional(),
  cep: z.string().trim().max(9, { error: "Máximo de 9 caracteres." }).optional(),
  endereco: z.string().trim().max(300, { error: "Máximo de 300 caracteres." }).optional(),
  cidade: z.string().trim().max(100, { error: "Máximo de 100 caracteres." }).optional(),
  estado: z.string().trim().max(2, { error: "Use a sigla do estado (2 letras)." }).optional(),
  observacoes: z.string().trim().max(2000, { error: "Máximo de 2000 caracteres." }).optional(),
  ativo: z.boolean(),
});

export type FornecedorFormValues = z.infer<typeof fornecedorFormSchema>;

export type Fornecedor = {
  id: string;
  nome_contato: string;
  nome_empresa: string;
  categoria: FornecedorCategoria;
  telefone: string | null;
  email: string | null;
  whatsapp: string | null;
  site: string | null;
  cep: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};
