// Bucket das fotos de campanhas de marketing.
//
// Criado via migration SQL (supabase/migrations/20260917500000_campanhas_marketing.sql,
// `insert into storage.buckets (...)`), não precisa ser criado manualmente
// no painel Supabase — mesmo padrão já usado pelos buckets "login-banners"
// e "escola-logo" neste projeto. Público (a foto só ilustra o card no
// admin, sem dado sensível); upload/gestão do arquivo continua restrito a
// admin via policies em storage.objects (ver a migration).
export const CAMPANHA_BUCKET = "campanhas-marketing";

export const CAMPANHA_FOTO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB
export const CAMPANHA_FOTO_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
