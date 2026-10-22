import { z } from "zod";

export const CURSO_TIPOS = ["presencial", "ead", "hibrido"] as const;
export const CURSO_STATUSES = ["ativo", "inativo"] as const;

export const CURSO_TIPO_LABELS: Record<(typeof CURSO_TIPOS)[number], string> = {
  presencial: "Presencial",
  ead: "EAD",
  hibrido: "Híbrido",
};

export const CURSO_STATUS_LABELS: Record<(typeof CURSO_STATUSES)[number], string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

// Mesmo padrão de cores fixas via className usado em STATUS_ALUNO_BADGE_CLASS
// (src/lib/alunos/schema.ts) — os variants padrão do Badge não cobrem
// verde/vermelho.
export const CURSO_STATUS_BADGE_CLASS: Record<(typeof CURSO_STATUSES)[number], string> = {
  ativo: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  inativo: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export const cursoFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do curso." })
    .trim()
    .min(1, { error: "Informe o nome do curso." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  descricao: z
    .string()
    .trim()
    .max(2000, { error: "A descrição pode ter no máximo 2000 caracteres." })
    .optional(),
  tipo: z.enum(CURSO_TIPOS, { error: "Selecione o tipo do curso." }),
  status: z.enum(CURSO_STATUSES, { error: "Selecione o status do curso." }),
  carga_horaria_horas: z.coerce
    .number({ error: "Informe um número válido." })
    .int({ error: "A carga horária deve ser um número inteiro." })
    .positive({ error: "A carga horária deve ser maior que zero." })
    .optional(),
  valor: z.coerce.number().min(0, "Valor não pode ser negativo").optional(),
});

export type CursoFormValues = z.infer<typeof cursoFormSchema>;

export type Curso = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: (typeof CURSO_TIPOS)[number];
  status: (typeof CURSO_STATUSES)[number];
  disponivel_para_resgate: boolean;
  custo_creditos: number | null;
  capa_url: string | null;
  carga_horaria_horas: number | null;
  valor: number | null;
  gratuito: boolean;
  url_plataforma_externa: string | null;
  // Texto livre ("40h", "20 horas") — NÃO é a mesma coluna que carga_horaria_horas (numérica,
  // usada pelo CursoForm principal). Só cursos gratuitos usam esta.
  carga_horaria: string | null;
  foto_url: string | null;
  foto_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Formulário dedicado de /admin/cursos-gratuitos — campos reduzidos em relação ao CursoForm
// principal (sem tipo/valor: cursos gratuitos são hospedados numa plataforma externa, o aluno
// só precisa do link). tipo é fixado como "ead" na Server Action (coluna not null sem default,
// mas irrelevante pra um curso 100% externo). carga_horaria aqui é texto livre ("40h", "20
// horas"), diferente de carga_horaria_horas (numérica) do CursoForm principal — foto é tratada
// fora deste schema (upload multipart, mesmo padrão do campo "capa" do CursoForm).
export const cursoGratuitoFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do curso." })
    .trim()
    .min(1, { error: "Informe o nome do curso." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  descricao: z
    .string()
    .trim()
    .max(2000, { error: "A descrição pode ter no máximo 2000 caracteres." })
    .optional(),
  url_plataforma_externa: z
    .url({ error: "Informe uma URL válida (ex.: https://plataforma.com/curso)." })
    .max(500, { error: "A URL pode ter no máximo 500 caracteres." }),
  carga_horaria: z
    .string()
    .trim()
    .max(50, { error: "A carga horária pode ter no máximo 50 caracteres." })
    .optional(),
  status: z.enum(CURSO_STATUSES, { error: "Selecione o status do curso." }),
});

export type CursoGratuitoFormValues = z.infer<typeof cursoGratuitoFormSchema>;
