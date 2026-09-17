// Script único (não roda em produção) pra gerar os ícones PNG exigidos pelo
// manifest.json do PWA (roadmap, item 7) — Chrome só dispara
// beforeinstallprompt com um ícone PNG >= 192x192, favicon.ico não serve.
//
// "G" simples sobre fundo dark navy, renderizado via SVG e rasterizado pelo
// sharp — placeholder funcional até existir uma logo de verdade.
//
// Rodar com: node scripts/gerar-icones-pwa.ts
// (Node 24 executa .ts diretamente via type-stripping, sem precisar de
// ts-node/tsx — sharp já está em node_modules como optionalDependency do
// Next, ver package-lock.json.)

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUTPUT_DIR = join(process.cwd(), "public", "icons");
const COR_FUNDO = "#0f172a";
const COR_LETRA = "#ffffff";

function svgIcone(tamanho: number): string {
  const fontSize = Math.round(tamanho * 0.55);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}">
  <rect width="${tamanho}" height="${tamanho}" fill="${COR_FUNDO}" />
  <text
    x="50%"
    y="52%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="${COR_LETRA}"
  >G</text>
</svg>`.trim();
}

async function gerarIcone(tamanho: number, arquivo: string): Promise<void> {
  const destino = join(OUTPUT_DIR, arquivo);
  await sharp(Buffer.from(svgIcone(tamanho))).png().toFile(destino);
  console.log(`Gerado: public/icons/${arquivo} (${tamanho}x${tamanho})`);
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await gerarIcone(192, "icon-192.png");
  await gerarIcone(512, "icon-512.png");
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
