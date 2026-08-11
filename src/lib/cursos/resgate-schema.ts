import { z } from "zod";

// Formulário separado do CursoForm principal — só aparece na edição, não
// na criação (decisão do plano: resgatabilidade é configurada depois de
// o curso já existir).
export const cursoResgateFormSchema = z
  .object({
    disponivel_para_resgate: z.boolean(),
    custo_creditos: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce
        .number()
        .int({ error: "O custo em créditos precisa ser um número inteiro." })
        .positive({ error: "O custo em créditos precisa ser maior que zero." })
        .optional(),
    ),
  })
  .refine((data) => !data.disponivel_para_resgate || data.custo_creditos !== undefined, {
    error: "Informe o custo em créditos para tornar o curso resgatável.",
    path: ["custo_creditos"],
  });

export type CursoResgateFormValues = z.infer<typeof cursoResgateFormSchema>;
