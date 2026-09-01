// Bucket da assinatura visual do diretor(a), embutida no rodapé do PDF do
// contrato (src/lib/contratos/pdf.tsx). Mesmo padrão do bucket de logo da
// escola (src/lib/storage/escola-logo.ts).
export const ASSINATURA_ADMIN_BUCKET = "assinaturas";

// Bem menor que ESCOLA_LOGO_MAX_BYTES: é uma imagem simples de assinatura,
// não precisa do limite generoso pensado pra logo em alta resolução.
export const ASSINATURA_ADMIN_MAX_BYTES = 2 * 1024 * 1024; // 2MB

// Sem SVG (diferente da logo): @react-pdf/renderer's <Image> não renderiza
// SVG, só formatos raster — teria que ser convertido nesse ponto.
export const ASSINATURA_ADMIN_EXTENSOES_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const ASSINATURA_ADMIN_TIPOS_ACEITOS = Object.keys(ASSINATURA_ADMIN_EXTENSOES_POR_TIPO);
