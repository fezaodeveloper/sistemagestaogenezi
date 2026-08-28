import { z } from "zod";

export type LoginBanner = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  storage_path: string;
  public_url: string;
  ordem: number;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const bannerLoginUpdateSchema = z.object({
  titulo: z.string().trim().max(200, { error: "Máximo de 200 caracteres." }).optional(),
  subtitulo: z.string().trim().max(300, { error: "Máximo de 300 caracteres." }).optional(),
  ordem: z.coerce.number().int({ error: "A ordem deve ser um número inteiro." }).min(0),
  ativo: z.boolean(),
});

export type BannerLoginUpdateValues = z.infer<typeof bannerLoginUpdateSchema>;
