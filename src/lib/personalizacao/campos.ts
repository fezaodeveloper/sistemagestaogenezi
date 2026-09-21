// Personalização visual — definição dos campos de imagem, limites e utilitários sem dependência
// de servidor (tela, Server Actions e uploads no navegador compartilham isto).

export const TAG_PERSONALIZACAO = "personalizacao";
export const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;
export const LIMITE_NOME_APP = 100;

export type CampoImagem =
  | "escola_logo_url"
  | "escola_logo_escuro_url"
  | "escola_logo_colapsada_url"
  | "escola_logo_colapsada_escuro_url"
  | "escola_favicon_url"
  | "portal_login_imagem_fundo_url"
  | "pwa_icone_192_url"
  | "pwa_icone_512_url";

export type DefinicaoCampoImagem = {
  campo: CampoImagem;
  rotulo: string;
  nota?: string;
  // Fundo do preview: "escuro" para as versões de tema escuro, senão "claro".
  fundo: "claro" | "escuro";
  bucket: "escola-logo" | "login-banners";
  // Pasta dentro do bucket (o caminho salvo precisa começar por ela). Vazia = raiz.
  pasta: string;
  // true  = nome FIXO por campo + upsert (sem acúmulo de arquivos; a URL leva ?v= p/ cache);
  // false = nome com carimbo de data (cada envio tem URL própria).
  nomeFixo: boolean;
  arquivo: string;
  // MIME aceito -> extensão.
  tipos: Record<string, string>;
  maxBytes: number;
  // Dimensão exata exigida (ícones do PWA).
  dimensao?: { largura: number; altura: number };
};

const MB = 1024 * 1024;

const TIPOS_LOGO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

export const CAMPOS_IMAGEM: Record<CampoImagem, DefinicaoCampoImagem> = {
  escola_logo_url: {
    campo: "escola_logo_url",
    rotulo: "Logo tema claro",
    nota: "Usada nas telas de login, contratos e certificados.",
    fundo: "claro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "logo",
    tipos: TIPOS_LOGO,
    maxBytes: 10 * MB,
  },
  escola_logo_escuro_url: {
    campo: "escola_logo_escuro_url",
    rotulo: "Logo tema escuro",
    nota: "Aparece no painel admin e no portal do aluno (temas escuros). Vazia = usa a logo do tema claro.",
    fundo: "escuro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "logo-escuro",
    tipos: TIPOS_LOGO,
    maxBytes: 10 * MB,
  },
  escola_logo_colapsada_url: {
    campo: "escola_logo_colapsada_url",
    rotulo: "Logo colapsada (claro)",
    nota: "Versão pequena para sidebar recolhida.",
    fundo: "claro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "logo-colapsada",
    tipos: TIPOS_LOGO,
    maxBytes: 5 * MB,
  },
  escola_logo_colapsada_escuro_url: {
    campo: "escola_logo_colapsada_escuro_url",
    rotulo: "Logo colapsada (escuro)",
    nota: "Versão pequena para sidebar recolhida, no tema escuro.",
    fundo: "escuro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "logo-colapsada-escuro",
    tipos: TIPOS_LOGO,
    maxBytes: 5 * MB,
  },
  escola_favicon_url: {
    campo: "escola_favicon_url",
    rotulo: "Favicon",
    nota: "Ícone na aba do navegador. Quadrado; PNG, ICO ou SVG.",
    fundo: "claro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "favicon",
    tipos: {
      "image/png": "png",
      "image/x-icon": "ico",
      "image/vnd.microsoft.icon": "ico",
      "image/svg+xml": "svg",
    },
    maxBytes: 1 * MB,
  },
  portal_login_imagem_fundo_url: {
    campo: "portal_login_imagem_fundo_url",
    rotulo: "Imagem da tela de login",
    nota: "Fundo (modelo Cartão) ou imagem lateral (modelo Dividido) da tela de entrada do aluno.",
    fundo: "claro",
    // Mesmo bucket/pasta do editor de login (Portal do Aluno > Login).
    bucket: "login-banners",
    pasta: "portal-aluno/",
    nomeFixo: false,
    arquivo: "fundo",
    tipos: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
    maxBytes: 5 * MB,
  },
  pwa_icone_192_url: {
    campo: "pwa_icone_192_url",
    rotulo: "Ícone PWA 192x192",
    nota: "PNG exatamente 192x192 px.",
    fundo: "claro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "pwa-192",
    tipos: { "image/png": "png" },
    maxBytes: 1 * MB,
    dimensao: { largura: 192, altura: 192 },
  },
  pwa_icone_512_url: {
    campo: "pwa_icone_512_url",
    rotulo: "Ícone PWA 512x512",
    nota: "PNG exatamente 512x512 px.",
    fundo: "claro",
    bucket: "escola-logo",
    pasta: "",
    nomeFixo: true,
    arquivo: "pwa-512",
    tipos: { "image/png": "png" },
    maxBytes: 1 * MB,
    dimensao: { largura: 512, altura: 512 },
  },
};

export function isCampoImagem(valor: unknown): valor is CampoImagem {
  return typeof valor === "string" && Object.hasOwn(CAMPOS_IMAGEM, valor);
}

// Caminho do arquivo dentro do bucket, a partir da URL pública (sem o ?v= de cache); null se a
// URL não é do bucket informado neste projeto. Usada pelo servidor para validar e limpar.
export function caminhoNoBucket(url: string | null | undefined, bucket: string, supabaseUrl: string): string | null {
  if (!url) return null;
  const prefixo = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(prefixo)) return null;
  const caminho = url.slice(prefixo.length).split("?")[0];
  return caminho && /^[\w./-]+$/.test(caminho) && !caminho.includes("..") ? caminho : null;
}

// Nome curto para o PWA (short_name do manifest, ~12 caracteres): a primeira palavra.
export function nomeCurtoApp(nome: string): string {
  const primeira = nome.trim().split(/\s+/)[0] ?? "";
  return primeira.slice(0, 12);
}
