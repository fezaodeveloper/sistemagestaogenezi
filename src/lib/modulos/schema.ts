import { z } from "zod";

export const moduloFormSchema = z.object({
  numero: z.coerce
    .number({ error: "Informe o número do módulo." })
    .int({ error: "O número deve ser um número inteiro." })
    .positive({ error: "O número deve ser maior que zero." }),
  titulo: z
    .string({ error: "Informe o título do módulo." })
    .trim()
    .min(1, { error: "Informe o título do módulo." })
    .max(200, { error: "O título pode ter no máximo 200 caracteres." }),
  descricao: z
    .string()
    .trim()
    .max(2000, { error: "A descrição pode ter no máximo 2000 caracteres." })
    .optional(),
});

export type ModuloFormValues = z.infer<typeof moduloFormSchema>;

export type Modulo = {
  id: string;
  curso_id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
