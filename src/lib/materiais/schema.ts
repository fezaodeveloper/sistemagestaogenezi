import { z } from "zod";

export const MATERIAL_TIPOS = ["pdf", "video_youtube", "slide", "link"] as const;

export const MATERIAL_TIPO_LABELS: Record<(typeof MATERIAL_TIPOS)[number], string> = {
  pdf: "PDF",
  video_youtube: "Vídeo (YouTube)",
  slide: "Slide",
  link: "Link",
};

export type MaterialTipoComUrl = Exclude<(typeof MATERIAL_TIPOS)[number], "pdf">;

export const MATERIAL_URL_LABELS: Record<MaterialTipoComUrl, string> = {
  video_youtube: "URL do vídeo no YouTube",
  slide: "URL do slide",
  link: "URL",
};

const tituloSchema = z
  .string({ error: "Informe o título do material." })
  .trim()
  .min(1, { error: "Informe o título do material." })
  .max(200, { error: "O título pode ter no máximo 200 caracteres." });

const ordemSchema = z.coerce
  .number({ error: "Informe a ordem de exibição." })
  .int({ error: "A ordem deve ser um número inteiro." })
  .positive({ error: "A ordem deve ser maior que zero." });

export const materialUrlFormSchema = z.object({
  titulo: tituloSchema,
  ordem: ordemSchema,
  url: z.url({ error: "Informe uma URL válida (começando com http:// ou https://)." }),
});

export type MaterialUrlFormValues = z.infer<typeof materialUrlFormSchema>;

export const materialPdfMetaFormSchema = z.object({
  titulo: tituloSchema,
  ordem: ordemSchema,
});

export type MaterialPdfMetaFormValues = z.infer<typeof materialPdfMetaFormSchema>;

export type Material = {
  id: string;
  aula_id: string;
  tipo: (typeof MATERIAL_TIPOS)[number];
  titulo: string;
  url: string;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
