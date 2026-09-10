import { z } from "zod";

export type AcessoRemoto = {
  id: string;
  nome_pc: string;
  login: string;
  senha: string;
  ip: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const acessoRemotoFormSchema = z.object({
  nome_pc: z
    .string({ error: "Informe o nome do PC." })
    .trim()
    .min(1, { error: "Informe o nome do PC." })
    .max(200, { error: "O nome pode ter no máximo 200 caracteres." }),
  login: z
    .string({ error: "Informe o login." })
    .trim()
    .min(1, { error: "Informe o login." })
    .max(200, { error: "O login pode ter no máximo 200 caracteres." }),
  senha: z
    .string({ error: "Informe a senha." })
    .min(1, { error: "Informe a senha." })
    .max(200, { error: "A senha pode ter no máximo 200 caracteres." }),
  ip: z.string().trim().max(100, { error: "IP muito longo." }).optional(),
  observacoes: z.string().trim().max(2000, { error: "Observações muito longas." }).optional(),
  ativo: z.boolean(),
});

export type AcessoRemotoFormValues = z.infer<typeof acessoRemotoFormSchema>;
