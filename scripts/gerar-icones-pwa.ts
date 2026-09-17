// Script único (não roda em produção) pra gerar os ícones PNG exigidos pelo
// manifest.json do PWA (roadmap, item 7) — Chrome só dispara
// beforeinstallprompt com um ícone PNG >= 192x192, favicon.ico não serve.
//
// Logo real da Gênezi centralizada sobre fundo dark navy, com padding
// proporcional — substitui o placeholder anterior ("G" em texto simples).
//
// A logo foi baixada uma única vez via conector do Google Drive (não por
// fetch direto na URL pública "uc?export=download") e está versionada em
// scripts/assets/logo-genezi-original.png. Esse endpoint não é uma API
// estável: pra este arquivo o Google devolve uma página HTML de aviso ("não
// foi possível verificar vírus") em vez dos bytes da imagem quando baixado
// sem sessão de navegador, então um fetch direto quebraria silenciosamente
// (content-type text/html salvo como se fosse PNG). Rodar de novo não
// precisa de rede nem do link do Drive.
//
// Rodar com: node scripts/gerar-icones-pwa.ts
// (Node 24 executa .ts diretamente via type-stripping, sem precisar de
// ts-node/tsx — sharp já está em node_modules como optionalDependency do
// Next, ver package-lock.json.)

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUTPUT_DIR = join(process.cwd(), "public", "icons");
const LOGO_PATH = join(process.cwd(), "scripts", "assets", "logo-genezi-original.png");
const COR_FUNDO = "#0f172a";

// Logo ocupa ~72% do canvas (padding proporcional de ~14% por lado) — espaço
// suficiente pra sobreviver ao corte circular/quadrado que Android aplica em
// ícones maskable (o manifest reaproveita o icon-192 pros dois purposes).
const PROPORCAO_LOGO = 0.72;

async function gerarIcone(tamanho: number, arquivo: string): Promise<void> {
  const tamanhoLogo = Math.round(tamanho * PROPORCAO_LOGO);

  const logoRedimensionada = await sharp(LOGO_PATH)
    .resize({ width: tamanhoLogo, height: tamanhoLogo, fit: "inside" })
    .toBuffer();

  const destino = join(OUTPUT_DIR, arquivo);
  await sharp({
    create: {
      width: tamanho,
      height: tamanho,
      channels: 4,
      background: COR_FUNDO,
    },
  })
    .composite([{ input: logoRedimensionada, gravity: "center" }])
    .png()
    .toFile(destino);

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
