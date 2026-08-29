// Bucket da logomarca da escola, exibida nas telas de login (/login e
// /entrar) e futuramente em certificados. Criado via migration SQL
// (supabase/migrations/20260916100000_banners_tamanho_texto.sql), mesmo
// padrão dos demais buckets do projeto. Público (leitura sem autenticação,
// necessária pois a tela de login não tem sessão); upload/gestão do
// arquivo continua restrito a admin via policies em storage.objects.
export const ESCOLA_LOGO_BUCKET = "escola-logo";

export const ESCOLA_LOGO_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const ESCOLA_LOGO_EXTENSOES_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

export const ESCOLA_LOGO_TIPOS_ACEITOS = Object.keys(ESCOLA_LOGO_EXTENSOES_POR_TIPO);
