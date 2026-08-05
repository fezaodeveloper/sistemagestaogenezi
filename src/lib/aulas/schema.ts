import { z } from "zod";

export const aulaFormSchema = z.object({
  numero: z.coerce
    .number({ error: "Informe o número da aula." })
    .int({ error: "O número deve ser um número inteiro." })
    .positive({ error: "O número deve ser maior que zero." }),
  titulo: z
    .string({ error: "Informe o título da aula." })
    .trim()
    .min(1, { error: "Informe o título da aula." })
    .max(200, { error: "O título pode ter no máximo 200 caracteres." }),
  conteudo: z
    .string()
    .trim()
    .max(5000, { error: "O conteúdo pode ter no máximo 5000 caracteres." })
    .optional(),
});

export type AulaFormValues = z.infer<typeof aulaFormSchema>;

export type Aula = {
  id: string;
  modulo_id: string;
  numero: number;
  titulo: string;
  conteudo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
