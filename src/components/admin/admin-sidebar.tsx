import type { CurrentUser } from "@/lib/auth/dal";
import { escolherLogo, type LogosEscola } from "@/lib/personalizacao/logos";
import { UserMenu } from "@/components/auth/user-menu";
import { getContagemNaoLidasAdminAction } from "@/lib/chat/badge-actions";
import { AdminNavGroups } from "@/components/admin/admin-nav-groups";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

// Cabeçalho da sidebar. O painel admin é SEMPRE escuro (classe admin-dark no layout), então usa a
// "logo tema escuro" e, na falta dela, a do tema claro.
//  * Com logo completa: só a logo (no modo ícone da sidebar, se um dia for ativado, troca pela
//    logo colapsada — as classes group-data-[collapsible=icon] já deixam isso pronto).
//  * Só com a logo colapsada (pequena): ela substitui o "G" e o nome continua ao lado.
//  * Sem nenhuma: o visual de sempre ("G" + GÊNEZI).
function CabecalhoSidebar({ logos }: { logos: LogosEscola }) {
  const completa = escolherLogo(logos.claro, logos.escuro, "escuro");
  const pequena = escolherLogo(logos.colapsadaClaro, logos.colapsadaEscuro, "escuro");

  if (completa) {
    return (
      <div className="flex items-center px-2 py-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto */}
        <img
          src={completa}
          alt="Logo da escola"
          className={`h-9 max-w-full object-contain object-left ${pequena ? "group-data-[collapsible=icon]:hidden" : ""}`}
        />
        {pequena && (
          // eslint-disable-next-line @next/next/no-img-element -- idem
          <img
            src={pequena}
            alt="Logo da escola"
            className="hidden size-8 object-contain group-data-[collapsible=icon]:block"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      {pequena ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
        <img src={pequena} alt="Logo da escola" className="size-9 shrink-0 rounded-lg object-contain" />
      ) : (
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-[17px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #22D3EE, #1565C0)" }}
        >
          G
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-bold tracking-wide text-[#7DD3FC]">
          GÊNEZI
        </div>
        <div className="truncate text-[10.5px] text-sidebar-foreground/60">
          Educação Profissional
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar({
  user,
  conversasNaoLidas,
  pendenciasCount,
  logos,
}: {
  user: CurrentUser;
  conversasNaoLidas: number;
  pendenciasCount: number;
  logos: LogosEscola;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <CabecalhoSidebar logos={logos} />
      </SidebarHeader>
      <SidebarContent>
        <AdminNavGroups
          conversasNaoLidas={conversasNaoLidas}
          refetchAction={getContagemNaoLidasAdminAction}
          pendenciasCount={pendenciasCount}
        />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
