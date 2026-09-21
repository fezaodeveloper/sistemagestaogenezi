import "server-only";

import { REGEX_COR_HEX, TAG_PERSONALIZACAO } from "@/lib/personalizacao/campos";

// Dados de personalização que aparecem em páginas SEM sessão (favicon, theme-color, manifest do
// PWA). Lidos como `anon` — por isso só as colunas liberadas pra anon na migration.
export type PersonalizacaoPublica = {
  escolaNome: string | null;
  corPrimaria: string | null;
  corPwa: string | null;
  faviconUrl: string | null;
  pwaIcone192Url: string | null;
  pwaIcone512Url: string | null;
};

type Linha = {
  escola_nome: string | null;
  escola_cor_primaria: string | null;
  escola_cor_pwa: string | null;
  escola_favicon_url: string | null;
  pwa_icone_192_url: string | null;
  pwa_icone_512_url: string | null;
};

const COLUNAS =
  "escola_nome,escola_cor_primaria,escola_cor_pwa,escola_favicon_url,pwa_icone_192_url,pwa_icone_512_url";

function corOuNull(valor: string | null): string | null {
  return valor && REGEX_COR_HEX.test(valor) ? valor : null;
}

function urlOuNull(valor: string | null): string | null {
  return valor && /^https:\/\/[^\s"'()\\<>]+$/.test(valor) ? valor : null;
}

// Busca direta na API REST do Supabase (sem cookies: usar o client do @supabase/ssr aqui tornaria
// TODAS as rotas dinâmicas, já que isto roda no layout raiz). O `fetch` entra no cache de dados do
// Next com revalidate de 1h e a tag TAG_PERSONALIZACAO — as Server Actions da tela de
// personalização expiram a tag (updateTag), então a mudança vale na hora, sem esperar 1h.
//
// NUNCA lança e nunca derruba o app: qualquer falha (env ausente, migration ainda não aplicada —
// coluna sem grant faz o PostgREST recusar a consulta inteira —, banco fora do ar) devolve null e
// quem chama usa os padrões de sempre.
export async function getPersonalizacaoPublica(): Promise<PersonalizacaoPublica | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return null;

  try {
    const resposta = await fetch(`${url}/rest/v1/configuracoes?select=${COLUNAS}&id=eq.true&limit=1`, {
      headers: { apikey: chave, Accept: "application/json" },
      next: { revalidate: 3600, tags: [TAG_PERSONALIZACAO] },
    });
    if (!resposta.ok) return null;

    const linhas = (await resposta.json()) as Linha[];
    const linha = linhas[0];
    if (!linha) return null;

    return {
      escolaNome: linha.escola_nome?.trim() || null,
      corPrimaria: corOuNull(linha.escola_cor_primaria),
      corPwa: corOuNull(linha.escola_cor_pwa),
      faviconUrl: urlOuNull(linha.escola_favicon_url),
      pwaIcone192Url: urlOuNull(linha.pwa_icone_192_url),
      pwaIcone512Url: urlOuNull(linha.pwa_icone_512_url),
    };
  } catch {
    return null;
  }
}

// Cor do PWA/theme-color: a do PWA, senão a primária, senão o azul-marinho de sempre.
export const COR_PWA_PADRAO = "#0f172a";

export function corDoPwa(p: PersonalizacaoPublica | null): string {
  return p?.corPwa ?? p?.corPrimaria ?? COR_PWA_PADRAO;
}
