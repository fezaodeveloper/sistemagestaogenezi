import { z } from "zod";

export type Conversa = {
  id: string;
  aluno_id: string;
  ultima_mensagem_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MensagemChat = {
  id: string;
  conversa_id: string;
  remetente_id: string;
  texto: string;
  lido_em: string | null;
  created_at: string;
};

export const mensagemFormSchema = z.object({
  texto: z
    .string({ error: "Escreva uma mensagem." })
    .trim()
    .min(1, { error: "Escreva uma mensagem." })
    .max(4000, { error: "Mensagem muito longa (máximo 4000 caracteres)." }),
});
