"use client";

// "use client": destaca a aba atual pela rota (usePathname).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, MessageSquare, Users, type LucideIcon } from "lucide-react";

// Abas do portal do aluno. Cada uma é uma SUBROTA de /admin/configuracoes/portal-aluno:
// para acrescentar uma aba nova, crie a pasta da rota e uma entrada aqui.
export const SECOES_PORTAL_ALUNO: { href: string; label: string; descricao: string; icone: LucideIcon }[] = [
  {
    href: "/admin/configuracoes/portal-aluno/login",
    label: "Login",
    descricao: "Aparência e acesso",
    icone: LogIn,
  },
  {
    href: "/admin/configuracoes/portal-aluno/comentarios",
    label: "Comentários",
    descricao: "Comentários nas aulas",
    icone: MessageSquare,
  },
  {
    href: "/admin/configuracoes/portal-aluno/comunidade",
    label: "Comunidade",
    descricao: "Fórum dos alunos",
    icone: Users,
  },
];

export function PortalAlunoNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções do portal do aluno" className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
      {SECOES_PORTAL_ALUNO.map((secao) => {
        const Icone = secao.icone;
        const ativa = pathname === secao.href || pathname.startsWith(`${secao.href}/`);
        return (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={ativa ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              ativa ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent/50"
            }`}
          >
            <Icone className="size-4" />
            <span className="flex flex-col">
              <span>{secao.label}</span>
              <span className="text-muted-foreground text-xs font-normal">{secao.descricao}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
