import type { NextConfig } from "next";

// Incidente: deploy na Vercel falhou com "figtree_<hash>.module.css module-not-found" mesmo com
// o código correto e o build local passando (inclusive com .next local intacto, sem apagar) —
// cache de build da Vercel com uma referência stale ao nome de módulo CSS antigo da fonte
// Figtree (o hash vem da config inteira do next/font, ver src/app/layout.tsx). Resolvido mudando
// a config da fonte (adicionando display: "swap"), o que gera um hash novo e elimina a colisão
// com o cache antigo — nenhuma mudança precisou entrar aqui.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default é 1MB — pequeno demais para upload de PDF de material de
      // curso (a action de materiais faz upload de arquivo via FormData).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
