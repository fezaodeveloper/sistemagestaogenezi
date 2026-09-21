import { NextResponse } from "next/server";
import { nomeCurtoApp } from "@/lib/personalizacao/campos";
import { corDoPwa, getPersonalizacaoPublica } from "@/lib/personalizacao/publico";

// Manifest do PWA — antes um arquivo estático (public/manifest.json), agora gerado a partir de
// Configurações > Personalização. Continua na MESMA URL (/manifest.json): PWAs já instalados e a
// tag <link rel="manifest"> do layout não mudam. Sem nada configurado devolve exatamente o
// conteúdo do arquivo antigo.
//
// Dinâmico de propósito: os dados vêm do fetch com cache de 1h + tag (ver publico.ts), então a
// consulta ao banco não roda a cada requisição, mas o manifest nunca fica "congelado" no build.
export const dynamic = "force-dynamic";

const ICONE_192_PADRAO = "/icons/icon-192.png";
const ICONE_512_PADRAO = "/icons/icon-512.png";

export async function GET() {
  const p = await getPersonalizacaoPublica();

  const cor = corDoPwa(p);
  const icone192 = p?.pwaIcone192Url ?? ICONE_192_PADRAO;
  const icone512 = p?.pwaIcone512Url ?? ICONE_512_PADRAO;

  const manifest = {
    name: p?.escolaNome ?? "Gênezi Educação",
    short_name: (p?.escolaNome && nomeCurtoApp(p.escolaNome)) || "Gênezi",
    description: "Portal do Aluno — Gênezi Educação Profissional",
    start_url: "/aluno",
    display: "standalone",
    background_color: cor,
    theme_color: cor,
    orientation: "portrait",
    icons: [
      { src: icone192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icone192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: icone512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    categories: ["education"],
    lang: "pt-BR",
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Curto no navegador (a mudança aparece em minutos), longo no CDN.
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
