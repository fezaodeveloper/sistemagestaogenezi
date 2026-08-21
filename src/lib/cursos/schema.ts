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
  created_by: string;
  created_at: string;
  updated_at: string;
};
