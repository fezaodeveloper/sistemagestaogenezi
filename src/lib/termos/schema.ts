import { z } from "zod";

export const TERMO_TIPOS = ["uso", "imagem", "privacidade", "outro"] as const;
export type TermoTipo = (typeof TERMO_TIPOS)[number];

export const TERMO_TIPO_LABELS: Record<TermoTipo, string> = {
  uso: "Termos de Uso",
  imagem: "Termo de Uso de Imagem",
  privacidade: "Política de Privacidade",
  outro: "Outro",
};

export type Termo = {
  id: string;
  titulo: string;
  tipo: TermoTipo;
  conteudo: string;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const termoFormSchema = z.object({
  titulo: z
    .string({ error: "Informe o título." })
    .trim()
    .min(1, { error: "Informe o título." })
    .max(200, { error: "O título pode ter no máximo 200 caracteres." }),
  tipo: z.enum(TERMO_TIPOS, { error: "Selecione o tipo." }),
  conteudo: z
    .string({ error: "Informe o conteúdo do termo." })
    .trim()
    .min(1, { error: "Informe o conteúdo do termo." }),
  ativo: z.boolean(),
});

export type TermoFormValues = z.infer<typeof termoFormSchema>;
