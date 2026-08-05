import type { NextConfig } from "next";

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
