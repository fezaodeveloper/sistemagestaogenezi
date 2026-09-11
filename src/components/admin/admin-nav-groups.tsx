"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import {
  AlertTriangle, Award, Banknote, BarChart2, Briefcase, Building2, CalendarDays, CalendarRange, ChevronRight, ClipboardCheck, ClipboardList, Code2, FileBadge, FileSignature, FileText, Gift, GraduationCap, IdCard,
  LayoutDashboard, MessageCircle, MessagesSquare, Monitor, Package, PlayCircle, PlusCircle, Presentation, Receipt,
  Settings, Tags, Target, TrendingDown, Truck, UserPlus, Users, Wrench, Zap,
} from "lucide-react";
import { BadgeChatNaoLidas } from "@/components/chat/badge-chat-nao-lidas";

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: "chat" | "pendencias" };
type NavGroup = { id: string; label: string; icon: React.ElementType; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard, items: [
    { href: "/admin", label: "Painel", icon: LayoutDashboard },
    { href: "/admin/pendencias", label: "Pendências", icon: AlertTriangle, badge: "pendencias" },
    { href: "/admin/relatorios/academico", label: "Relatórios Acadêmicos", icon: GraduationCap },
    { href: "/admin/relatorios/financeiro", label: "Relatórios Financeiros", icon: BarChart2 },
  ]},
  { id: "matriculas", label: "Matrículas", icon: ClipboardCheck, items: [
    { href: "/admin/alunos", label: "Alunos", icon: IdCard },
    { href: "/admin/matriculas/nova", label: "Nova Matrícula", icon: PlusCircle },
    { href: "/admin/matriculas", label: "Lista de Matrículas", icon: ClipboardList },
    { href: "/admin/turmas", label: "Turmas", icon: Users },
    { href: "/admin/contratos", label: "Contratos", icon: FileSignature },
    { href: "/admin/termos", label: "Termos", icon: FileText },
  ]},
  { id: "academico", label: "Acadêmico", icon: GraduationCap, items: [
    { href: "/admin/cursos", label: "Cursos", icon: GraduationCap },
    { href: "/admin/certificados", label: "Certificados", icon: FileBadge },
    { href: "/admin/calendario", label: "Calendário", icon: CalendarDays },
    { href: "/admin/cronograma", label: "Cronograma", icon: CalendarRange },
    { href: "/admin/professor", label: "Painel do Professor", icon: Presentation },
    { href: "/admin/acesso-remoto", label: "Acesso Remoto", icon: Monitor },
    { href: "/admin/chat", label: "Chat", icon: MessagesSquare, badge: "chat" },
  ]},
  { id: "conecta", label: "Gênezi Conecta", icon: Building2, items: [
    { href: "/admin/conecta", label: "Empresas", icon: Building2 },
    { href: "/admin/conecta/vagas", label: "Vagas", icon: Briefcase },
    { href: "/admin/conecta/candidatos", label: "Candidatos", icon: Users },
  ]},
  { id: "financeiro", label: "Financeiro", icon: Banknote, items: [
    { href: "/admin/financeiro", label: "Mensalidades", icon: Banknote },
    { href: "/admin/financeiro/avulsos", label: "Pagamentos Avulsos", icon: Receipt },
    { href: "/admin/financeiro/gastos", label: "Gastos", icon: TrendingDown },
    { href: "/admin/financeiro/categorias", label: "Categorias", icon: Tags },
  ]},
  { id: "comercial", label: "Comercial", icon: Target, items: [
    { href: "/admin/leads", label: "Leads / CRM", icon: UserPlus },
  ]},
  { id: "engajamento", label: "Engajamento", icon: Gift, items: [
    { href: "/admin/premios", label: "Prêmios", icon: Gift },
    { href: "/admin/resgates", label: "Resgates", icon: Award },
    { href: "/admin/engajamento/recompensas", label: "Recompensas", icon: Gift },
  ]},
  { id: "sistema", label: "Sistema", icon: Settings, items: [
    { href: "/admin/automacoes", label: "Log de Automações", icon: Zap },
    { href: "/admin/mensagens", label: "Automações", icon: MessageCircle },
    { href: "/admin/contrato", label: "Template de Contrato", icon: FileText },
    { href: "/admin/treinamentos", label: "Treinamentos", icon: PlayCircle },
    { href: "/admin/api", label: "API & Integrações", icon: Code2 },
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
    { href: "/admin/estoque", label: "Estoque", icon: Package },
    { href: "/admin/manutencao", label: "Manutenção", icon: Wrench },
    { href: "/admin/fornecedores", label: "Fornecedores", icon: Truck },
  ]},
];

function isItemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

// Grupo dono da página atual — usado tanto pro estado inicial (só ele
// aberto ao montar/recarregar) quanto pra reabrir ao navegar entre páginas
// de grupos diferentes sem remontar o componente (ver efeito abaixo).
function grupoAtivo(pathname: string): string | null {
  return GROUPS.find((g) => g.items.some((i) => isItemActive(pathname, i.href)))?.id ?? null;
}

export function AdminNavGroups({
  conversasNaoLidas,
  refetchAction,
  pendenciasCount,
}: {
  conversasNaoLidas: number;
  refetchAction: () => Promise<number>;
  pendenciasCount: number;
}) {
  const pathname = usePathname();
  // Sem persistência em localStorage de propósito: um reload sempre começa
  // com tudo fechado, exceto o grupo da página atual. usePathname() já
  // resolve pro caminho certo tanto no server quanto no client (não é um
  // valor só-client como localStorage), então calcular aqui no
  // inicializador não causa hydration mismatch.
  const [open, setOpen] = useState<string[]>(() => {
    const ativo = grupoAtivo(pathname);
    return ativo ? [ativo] : [];
  });

  // Reabre o grupo da página atual ao navegar entre páginas de grupos
  // diferentes (client-side, sem remontar este componente) — nunca fecha
  // outros grupos que o admin tenha aberto manualmente.
  useEffect(() => {
    const ativo = grupoAtivo(pathname);
    if (!ativo) return;
    startTransition(() => {
      setOpen((prev) => (prev.includes(ativo) ? prev : [...prev, ativo]));
    });
  }, [pathname]);

  function toggle(id: string) {
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2">
      {GROUPS.map((group) => {
        const isOpen = open.includes(group.id);
        const GroupIcon = group.icon;
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggle(group.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/70 transition-colors hover:bg-white/[0.03] hover:text-sidebar-foreground"
            >
              <GroupIcon className="size-4 shrink-0 opacity-70" />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronRight
                className={"size-3.5 shrink-0 opacity-60 transition-transform " + (isOpen ? "rotate-90" : "")}
              />
            </button>
            {isOpen && (
              <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.href} className="relative">
                      <Link
                        href={item.href}
                        className={
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors " +
                          (active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-white/[0.03] hover:text-foreground")
                        }
                      >
                        <ItemIcon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                      {item.badge === "chat" && (
                        <BadgeChatNaoLidas
                          key={conversasNaoLidas}
                          initialCount={conversasNaoLidas}
                          refetchAction={refetchAction}
                        />
                      )}
                      {item.badge === "pendencias" && pendenciasCount > 0 && (
                        <span className="bg-destructive absolute top-1.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white">
                          {pendenciasCount > 99 ? "99+" : pendenciasCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
