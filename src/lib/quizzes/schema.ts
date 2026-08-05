import { z } from "zod";

export const quizFormSchema = z
  .object({
    titulo: z
      .string({ error: "Informe o título do quiz." })
      .trim()
      .min(1, { error: "Informe o título do quiz." })
      .max(200, { error: "O título pode ter no máximo 200 caracteres." }),
    nota_minima_ativa: z.boolean(),
    nota_minima_percentual: z.coerce
      .number()
      .int({ error: "A nota mínima deve ser um número inteiro." })
      .min(1, { error: "A nota mínima deve ser entre 1 e 100." })
      .max(100, { error: "A nota mínima deve ser entre 1 e 100." })
      .optional(),
    tentativas_limitadas: z.boolean(),
    tentativas_maximas: z.coerce
      .number()
      .int({ error: "O número de tentativas deve ser um número inteiro." })
      .positive({ error: "O número de tentativas deve ser maior que zero." })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.nota_minima_ativa && data.nota_minima_percentual === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["nota_minima_percentual"],
        message: "Informe a nota mínima para aprovação (1 a 100).",
      });
    }
    if (data.tentativas_limitadas && data.tentativas_maximas === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["tentativas_maximas"],
        message: "Informe o número máximo de tentativas.",
      });
    }
  });

export type QuizFormValues = z.infer<typeof quizFormSchema>;

export type Quiz = {
  id: string;
  aula_id: string;
  titulo: string;
  nota_minima_ativa: boolean;
  nota_minima_percentual: number | null;
  tentativas_limitadas: boolean;
  tentativas_maximas: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
