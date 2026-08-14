import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getContagemConversasNaoLidasAdmin } from "@/lib/chat/chat";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área do gestor: tema claro forçado, independente de preferência do sistema
// (decisão de produto — ver CLAUDE.md).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  const supabase = await createClient();
  const conversasNaoLidas = await getContagemConversasNaoLidasAdmin(supabase);

  return (
    <div className="bg-background text-foreground min-h-svh">
      <SidebarProvider>
        <AdminSidebar user={user} conversasNaoLidas={conversasNaoLidas} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium">Painel administrativo</span>
          </header>
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
