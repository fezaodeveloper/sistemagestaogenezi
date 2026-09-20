"use client";

// "use client": submenu expansível (estado aberto/fechado) e destaque do item
// ativo pela rota atual (usePathname).

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, ChevronRight, FileText, Lock, Scale, Shield, type LucideIcon } from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const DOCUMENTOS: { href: string; label: string; icone: LucideIcon }[] = [
  { href: "/aluno/legal/privacidade", label: "Política de Privacidade", icone: Shield },
  { href: "/aluno/legal/termos", label: "Termos de Uso", icone: FileText },
  { href: "/aluno/legal/lgpd", label: "LGPD — Seus direitos", icone: Lock },
  { href: "/aluno/legal/imagem", label: "Uso de Imagem", icone: Camera },
];

// Item "Documentos Legais" da sidebar do aluno, com os 4 documentos num
// submenu. Abre sozinho quando a rota atual é um dos documentos (o aluno vê
// onde está); depois disso o clique no título alterna manualmente.
export function DocumentosLegaisMenu() {
  const pathname = usePathname();
  const dentroDeLegal = pathname.startsWith("/aluno/legal");
  const [aberto, setAberto] = useState<boolean | null>(null);
  const expandido = aberto ?? dentroDeLegal;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={dentroDeLegal && !expandido}
        aria-expanded={expandido}
        aria-controls="submenu-documentos-legais"
        onClick={() => setAberto(!expandido)}
      >
        <Scale />
        <span>Documentos Legais</span>
        <ChevronRight className={`ml-auto transition-transform ${expandido ? "rotate-90" : ""}`} />
      </SidebarMenuButton>
      {expandido && (
        <SidebarMenuSub id="submenu-documentos-legais">
          {DOCUMENTOS.map(({ href, label, icone: Icone }) => (
            <SidebarMenuSubItem key={href}>
              <SidebarMenuSubButton
                isActive={pathname === href}
                render={
                  <Link href={href}>
                    <Icone />
                    <span>{label}</span>
                  </Link>
                }
              />
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
