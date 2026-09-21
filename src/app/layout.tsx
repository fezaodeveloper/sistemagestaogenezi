import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { nomeCurtoApp } from "@/lib/personalizacao/campos";
import { corDoPwa, getPersonalizacaoPublica } from "@/lib/personalizacao/publico";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Favicon, ícone do iOS, nome do app e theme-color vêm de Configurações > Personalização
// (leitura pública com cache de 1h — ver getPersonalizacaoPublica; sem nada configurado, ou se a
// consulta falhar, vale exatamente o padrão de antes).
//
// O favicon padrão agora mora em public/favicon.ico (antes src/app/favicon.ico): um favicon em
// src/app tem PRIORIDADE sobre `metadata.icons` (doc do Next), o que impediria o dinâmico.
export async function generateMetadata(): Promise<Metadata> {
  const p = await getPersonalizacaoPublica();
  return {
    title: "Genezi — Sistema de Gestão",
    description: "Plataforma de gestão e portal do aluno da Genezi.",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: (p?.escolaNome && nomeCurtoApp(p.escolaNome)) || "Gênezi",
    },
    icons: {
      icon: p?.faviconUrl ?? "/favicon.ico",
      apple: p?.pwaIcone192Url ?? "/icons/icon-192.png",
    },
  };
}

// themeColor migrou de Metadata pra Viewport no Next 16 (o campo em
// Metadata está deprecated) — ver node_modules/next/dist/lib/metadata/types.
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: corDoPwa(await getPersonalizacaoPublica()) };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
