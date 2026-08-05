import { z } from "zod";

export const QUESTAO_TIPOS = ["multipla_escolha", "verdadeiro_falso", "dissertativa"] as const;

export const QUESTAO_TIPO_LABELS: Record<(typeof QUESTAO_TIPOS)[number], string> = {
  multipla_escolha: "Múltipla escolha",
  verdadeiro_falso: "Verdadeiro ou falso",
  dissertativa: "Dissertativa",
};

export const questaoBaseFormSchema = z.object({
  enunciado: z
    .string({ error: "Informe o enunciado." })
    .trim()
    .min(1, { error: "Informe o enunciado." })
    .max(2000, { error: "O enunciado pode ter no máximo 2000 caracteres." }),
  ordem: z.coerce
    .number({ error: "Informe a ordem de exibição." })
    .int({ error: "A ordem deve ser um número inteiro." })
    .positive({ error: "A ordem deve ser maior que zero." }),
});

export type QuestaoBaseFormValues = z.infer<typeof questaoBaseFormSchema>;

export type Questao = {
  id: string;
  quiz_id: string;
  tipo: (typeof QUESTAO_TIPOS)[number];
  enunciado: string;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Alternativa = {
  id: string;
  questao_id: string;
  texto: string;
  correta: boolean;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type QuestaoWithAlternativas = Questao & { alternativas: Alternativa[] };
