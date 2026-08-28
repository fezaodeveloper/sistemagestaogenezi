import type { CurrentUser } from "@/lib/auth/dal";
import { UserMenu } from "@/components/auth/user-menu";
import { getContagemNaoLidasAdminAction } from "@/lib/chat/badge-actions";
import { AdminNavGroups } from "@/components/admin/admin-nav-groups";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

export function AdminSidebar({
  user,
  conversasNaoLidas,
  pendenciasCount,
}: {
  user: CurrentUser;
  conversasNaoLidas: number;
  pendenciasCount: number;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-[17px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #22D3EE, #1565C0)" }}
          >
            G
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-wide text-[#7DD3FC]">
              GÊNEZI
            </div>
            <div className="truncate text-[10.5px] text-sidebar-foreground/60">
              Educação Profissional
            </div>
          </div>
        </div>
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
