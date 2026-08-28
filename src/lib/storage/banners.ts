// Bucket dos banners do carrossel da tela de login.
//
// Criado via migration SQL (supabase/migrations/20260915200000_login_banners.sql,
// `insert into storage.buckets (...)`), não precisa ser criado manualmente
// no painel Supabase — mesmo padrão já usado pelos buckets "cursos" e
// "premios" neste projeto. Público (leitura sem autenticação, necessária
// pois a tela de login não tem sessão); upload/gestão do arquivo continua
// restrito a admin via policies em storage.objects (ver a migration).
export const BANNER_BUCKET = "login-banners";

export const BANNER_TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB
export const BANNER_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
