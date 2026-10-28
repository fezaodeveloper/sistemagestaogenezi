"use client";

// "use client": estado do menu mobile (Sheet) — o resto é só navegação.

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const MENSAGEM_WHATSAPP_EMPRESAS = encodeURIComponent(
  "Olá! Tenho interesse em cadastrar minha empresa no Gênezi Conecta e disponibilizar vagas para os alunos.",
);

type LinkNav = { href: string; label: string; externo?: boolean };

// "Para empresas" vai pro WhatsApp quando configurado (REGRA: sem botão de cadastro direto de
// empresa nesta página) — só cai de volta no formulário se a escola ainda não configurou
// escola_telefone em /admin/configuracoes (defensivo, não o caminho esperado).
function linksNav(whatsappHref: string | null): LinkNav[] {
  return [
    { href: "#cidades", label: "Vagas" },
    whatsappHref
      ? { href: whatsappHref, label: "Para empresas", externo: true }
      : { href: "/empresa/cadastro", label: "Para empresas" },
    { href: "#como-funciona", label: "Como funciona" },
    { href: "#faq", label: "FAQ" },
    { href: "/empresa/login", label: "Entrar" },
  ];
}

function LogoGenezi({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
      <img src={logoUrl} alt="Gênezi" className="size-8 rounded-md object-contain" />
    );
  }
  return <span className="text-xl">🎓</span>;
}

export function ConectaHeader({
  logoUrl,
  whatsappEscolaDigitos,
}: {
  logoUrl: string | null;
  whatsappEscolaDigitos: string | null;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const whatsappHref = whatsappEscolaDigitos
    ? `https://wa.me/55${whatsappEscolaDigitos}?text=${MENSAGEM_WHATSAPP_EMPRESAS}`
    : null;
  const links = linksNav(whatsappHref);

  return (
    <header className="bg-background/95 border-border/50 fixed inset-x-0 top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/conecta/vagas" className="flex items-center gap-2 font-semibold">
          <LogoGenezi logoUrl={logoUrl} />
          Gênezi Conecta
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((link) =>
            link.externo ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.label} href={link.href} className="hover:text-primary transition-colors">
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuAberto(true)}>
          <Menu className="size-5" />
        </Button>
      </div>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Gênezi Conecta</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {links.map((link) =>
              link.externo ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-3 py-2 text-sm hover:bg-white/5"
                  onClick={() => setMenuAberto(false)}
                >
                  {link.label}
                </a>
              ) : (
                <SheetClose
                  key={link.label}
                  render={<Link href={link.href} className="rounded-md px-3 py-2 text-sm hover:bg-white/5" />}
                >
                  {link.label}
                </SheetClose>
              ),
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
