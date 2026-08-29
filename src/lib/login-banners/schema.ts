import { z } from "zod";

export const LOGIN_BANNER_TIPOS = ["admin", "aluno"] as const;
export type LoginBannerTipo = (typeof LOGIN_BANNER_TIPOS)[number];

export const LOGIN_BANNER_TIPO_LABELS: Record<LoginBannerTipo, string> = {
  admin: "Admin",
  aluno: "Aluno",
};

// Mesmo padrão de cores fixas via className usado em outros badges do
// projeto — azul pro admin, verde pro aluno (pedido explícito da tarefa).
export const LOGIN_BANNER_TIPO_BADGE_CLASS: Record<LoginBannerTipo, string> = {
  admin: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  aluno: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
};

export const LOGIN_BANNER_TAMANHOS = ["pequeno", "medio", "grande"] as const;
export type LoginBannerTamanho = (typeof LOGIN_BANNER_TAMANHOS)[number];

export const LOGIN_BANNER_TAMANHO_LABELS: Record<LoginBannerTamanho, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

export const LOGIN_BANNER_POSICOES = ["topo", "centro", "base"] as const;
export type LoginBannerTextoPosicao = (typeof LOGIN_BANNER_POSICOES)[number];

export const LOGIN_BANNER_POSICAO_LABELS: Record<LoginBannerTextoPosicao, string> = {
  topo: "Topo",
  centro: "Centro",
  base: "Base",
};

export type LoginBanner = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  storage_path: string;
  public_url: string;
  tipo: LoginBannerTipo;
  ordem: number;
  ativo: boolean;
  titulo_tamanho: LoginBannerTamanho;
  subtitulo_tamanho: LoginBannerTamanho;
  titulo_cor: string;
  subtitulo_cor: string;
  texto_posicao: LoginBannerTextoPosicao;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const corHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Informe uma cor hexadecimal válida (ex.: #FFFFFF)." });

export const bannerLoginUpdateSchema = z.object({
  titulo: z.string().trim().max(200, { error: "Máximo de 200 caracteres." }).optional(),
  subtitulo: z.string().trim().max(300, { error: "Máximo de 300 caracteres." }).optional(),
  ordem: z.coerce.number().int({ error: "A ordem deve ser um número inteiro." }).min(0),
  ativo: z.boolean(),
  titulo_tamanho: z.enum(LOGIN_BANNER_TAMANHOS),
  subtitulo_tamanho: z.enum(LOGIN_BANNER_TAMANHOS),
  titulo_cor: corHexSchema,
  subtitulo_cor: corHexSchema,
  texto_posicao: z.enum(LOGIN_BANNER_POSICOES),
});

export type BannerLoginUpdateValues = z.infer<typeof bannerLoginUpdateSchema>;
