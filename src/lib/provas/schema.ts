import { quizFormSchema } from "@/lib/quizzes/schema";

// Mesma forma exata de configuração do quiz (título + nota mínima com toggle
// + tentativas limitadas com toggle) — reaproveitado sem duplicar a lógica
// de validação.
export const provaFormSchema = quizFormSchema;

export type ProvaFormValues = ReturnType<typeof provaFormSchema.parse>;

export type Prova = {
  id: string;
  modulo_id: string;
  titulo: string;
  nota_minima_ativa: boolean;
  nota_minima_percentual: number | null;
  tentativas_limitadas: boolean;
  tentativas_maximas: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
