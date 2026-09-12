// Buckets do Gênezi Conecta — criados via migration SQL (mostrada, não
// aplicada: supabase/migrations/20260916900000_conecta_storage.sql), mesmo
// padrão dos demais buckets de imagem/arquivo do projeto.

export const LOGO_CONECTA_BUCKET = "logos-conecta";
export const LOGO_CONECTA_MAX_BYTES = 2 * 1024 * 1024; // 2MB

export const LOGO_CONECTA_EXTENSOES_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
export const LOGO_CONECTA_TIPOS_ACEITOS = Object.keys(LOGO_CONECTA_EXTENSOES_POR_TIPO);

// Privado — currículo é dado pessoal do aluno (REGRA da tarefa). Nome fixo
// (curriculos/{auth.uid()}.pdf), mesmo padrão anti-acúmulo dos demais
// buckets deste projeto.
export const CURRICULO_CONECTA_BUCKET = "curriculos-conecta";
export const CURRICULO_CONECTA_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const CURRICULO_CONECTA_TIPO_ACEITO = "application/pdf";
