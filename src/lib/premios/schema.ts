import { z } from "zod";

export const premioFormSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do prêmio." })
    .trim()
    .min(1, { error: "Informe o nome do prêmio." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  descricao: z
    .string()
    .trim()
    .max(2000, { error: "A descrição pode ter no máximo 2000 caracteres." })
    .optional(),
  custo_creditos: z.coerce
    .number({ error: "Informe o custo em créditos." })
    .int({ error: "O custo em créditos precisa ser um número inteiro." })
    .positive({ error: "O custo em créditos precisa ser maior que zero." }),
  estoque: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce
      .number()
      .int({ error: "O estoque precisa ser um número inteiro." })
      .min(0, { error: "O estoque não pode ser negativo." })
      .optional(),
  ),
  ativo: z.boolean(),
});

export type PremioFormValues = z.infer<typeof premioFormSchema>;

export type Premio = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  custo_creditos: number;
  estoque: number | null;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};
