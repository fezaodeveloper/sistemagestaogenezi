"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { GraduationCap, Banknote, Award, Coins, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Meus Cursos", href: "/aluno", icon: GraduationCap },
  { label: "Financeiro", href: "/aluno/financeiro", icon: Banknote },
  { label: "Conquistas", href: "/aluno/conquistas", icon: Award },
  { label: "Créditos", href: "/aluno/creditos", icon: Coins },
  { label: "Meu Perfil", href: "/aluno/perfil", icon: User },
];

export function AlunoBottomNav() {
  const isMobile = useIsMobile();
  const pathname = usePathname();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background px-2 md:hidden">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        // "Meus Cursos" só fica ativo na rota exata /aluno
        const isActive = item.href === "/aluno" ? pathname === "/aluno" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
