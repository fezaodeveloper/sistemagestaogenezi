// Bucket de logo/imagem de topo das páginas de campanha (roadmap, item 1).
//
// Criado via migration SQL (supabase/migrations/20260918100000_campanhas_paginas.sql,
// `insert into storage.buckets (...)`) — mesmo padrão dos buckets
// "login-banners" e "campanhas-marketing" já usados neste projeto. Público
// (só ilustra a landing page pública, sem dado sensível); upload/gestão do
// arquivo continua restrito a admin via policies em storage.objects.
export const CAMPANHA_PAGINA_BUCKET = "campanha-paginas";

export const CAMPANHA_PAGINA_IMAGEM_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB
export const CAMPANHA_PAGINA_IMAGEM_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] as const;
