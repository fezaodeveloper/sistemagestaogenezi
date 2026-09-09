import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

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
  conteudo_json: JSONContent | null;
  cor_texto: string;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const DOC_VAZIO: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function criarConteudoTermoVazio(): JSONContent {
  return DOC_VAZIO;
}

function isJsonContent(value: unknown): value is JSONContent {
  return typeof value === "object" && value !== null;
}

// Mesmo formato exigido por <input type="color"> (#rrggbb minúsculo) usado
// em contratos/schema.ts e certificados/schema.ts.
const corHex = z
  .string({ error: "Informe uma cor válida." })
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Informe uma cor no formato #RRGGBB." });

// Schema do editor rico (TermoEditorForm) — substitui o antigo
// termoFormSchema (Textarea simples): conteudo_json chega como string JSON
// do input hidden do EditorTextoCertificado, mesmo padrão de
// contratoTemplateFormSchema.
export const termoEditorFormSchema = z.object({
  titulo: z
    .string({ error: "Informe o título." })
    .trim()
    .min(1, { error: "Informe o título." })
    .max(200, { error: "O título pode ter no máximo 200 caracteres." }),
  tipo: z.enum(TERMO_TIPOS, { error: "Selecione o tipo." }),
  cor_texto: corHex,
  conteudo_json: z.string().transform((v, ctx) => {
    try {
      const parsed: unknown = JSON.parse(v);
      if (!isJsonContent(parsed)) throw new Error("formato inválido");
      return parsed;
    } catch {
      ctx.addIssue({ code: "custom", message: "Conteúdo do termo inválido." });
      return DOC_VAZIO;
    }
  }),
  ativo: z.boolean(),
});

export type TermoEditorFormValues = z.infer<typeof termoEditorFormSchema>;
