"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import {
  AlertTriangle, Award, Banknote, BarChart2, CalendarDays, CalendarRange, ChevronRight, ClipboardCheck, ClipboardList, Code2, FileBadge, FileSignature, FileText, Gift, GraduationCap, IdCard,
  LayoutDashboard, MessageCircle, MessagesSquare, Package, PlayCircle, PlusCircle, Presentation, Receipt,
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
    { href: "/admin/chat", label: "Chat", icon: MessagesSquare, badge: "chat" },
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

const STORAGE_KEY = "genezi-admin-nav-open";
const DEFAULT_OPEN = ["visao-geral", "comercial", "academico"];

function isItemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
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
  const [open, setOpen] = useState<string[]>(DEFAULT_OPEN);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Leitura de localStorage tem que ficar num efeito pós-montagem, não
      // num inicializador de useState: o componente é renderizado no
      // servidor (sem localStorage, sempre cairia em DEFAULT_OPEN) e depois
      // hidratado no cliente — se o cliente lesse localStorage já na
      // primeira passada, o estado divergiria do HTML gerado no servidor e
      // causaria hydration mismatch. Setar aqui, depois de montado, evita
      // isso de propósito.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setOpen(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    const active = GROUPS.find((g) => g.items.some((i) => isItemActive(pathname, i.href)));
    if (active) {
      startTransition(() => {
        setOpen((prev) => (prev.includes(active.id) ? prev : [...prev, active.id]));
      });
    }
  }, [pathname]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(open)); } catch {}
  }, [open, hydrated]);

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
