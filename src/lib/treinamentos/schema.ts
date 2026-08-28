import { z } from "zod";

export const TREINAMENTO_CATEGORIAS = [
  "primeiros_passos",
  "alunos",
  "matriculas",
  "financeiro",
  "academico",
  "relatorios",
  "geral",
] as const;

export type TreinamentoCategoria = (typeof TREINAMENTO_CATEGORIAS)[number];

export const TREINAMENTO_CATEGORIA_LABELS: Record<TreinamentoCategoria, string> = {
  primeiros_passos: "Primeiros Passos",
  alunos: "Alunos",
  matriculas: "Matrículas",
  financeiro: "Financeiro",
  academico: "Acadêmico",
  relatorios: "Relatórios",
  geral: "Geral",
};

// Mesmo padrão de cores fixas via className usado em MATRICULA_STATUS_BADGE_CLASS
// (src/lib/matriculas/schema.ts) e afins — uma cor por categoria, só pra
// diferenciar visualmente na tabela, sem significado além disso.
export const TREINAMENTO_CATEGORIA_BADGE_CLASS: Record<TreinamentoCategoria, string> = {
  primeiros_passos: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  alunos: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  matriculas: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
  financeiro: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  academico: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  relatorios: "bg-pink-500/10 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
  geral: "bg-muted text-muted-foreground",
};

export const TREINAMENTO_STATUSES = ["ativo", "inativo"] as const;
export type TreinamentoStatus = (typeof TREINAMENTO_STATUSES)[number];

export const TREINAMENTO_STATUS_LABELS: Record<TreinamentoStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

export const TREINAMENTO_STATUS_BADGE_CLASS: Record<TreinamentoStatus, string> = {
  ativo: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inativo: "bg-muted text-muted-foreground",
};

// Aceita watch?v=, youtu.be/, embed/ e shorts/ — só precisa achar os 11
// caracteres do ID do vídeo em algum lugar reconhecível da URL.
const YOUTUBE_ID_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

export function extrairYoutubeId(url: string): string | null {
  const match = YOUTUBE_ID_REGEX.exec(url);
  return match ? match[1] : null;
}

const youtubeUrlSchema = z
  .string({ error: "Informe a URL do vídeo." })
  .trim()
  .min(1, { error: "Informe a URL do vídeo." })
  .refine((value) => /youtube\.com|youtu\.be/.test(value), {
    error: "Informe uma URL válida do YouTube.",
  })
  .refine((value) => extrairYoutubeId(value) !== null, {
    error: "Não foi possível identificar o vídeo nessa URL.",
  });

export const treinamentoFormSchema = z.object({
  titulo: z
    .string({ error: "Informe o título." })
    .trim()
    .min(1, { error: "Informe o título." })
    .max(200, { error: "Título muito longo." }),
  descricao: z.string().trim().max(2000, { error: "Descrição muito longa." }).optional(),
  categoria: z.enum(TREINAMENTO_CATEGORIAS, { error: "Selecione a categoria." }),
  youtube_url: youtubeUrlSchema,
  status: z.enum(TREINAMENTO_STATUSES, { error: "Selecione o status." }),
  ordem: z.coerce
    .number({ error: "Informe um número." })
    .int({ error: "Informe um número inteiro." })
    .min(0, { error: "Não pode ser negativo." }),
});

export type TreinamentoFormValues = z.infer<typeof treinamentoFormSchema>;

export type Treinamento = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: TreinamentoCategoria;
  youtube_url: string;
  status: TreinamentoStatus;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
