import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getContagemConversasNaoLidasAdmin } from "@/lib/chat/chat";
import { getContadoresNotificacoes } from "@/lib/admin/notificacoes";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SinoNotificacoes } from "@/components/admin/sino-notificacoes";
import { BuscaGlobal } from "@/components/admin/busca-global";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área do gestor: tema dark Genezi (redesign aprovado - design-reference v3)
// (decisão de produto — ver CLAUDE.md).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  const supabase = await createClient();
  const [conversasNaoLidas, { data: config }] = await Promise.all([
    getContagemConversasNaoLidasAdmin(supabase),
    supabase
      .from("configuracoes")
      .select(
        "notif_financeiro_atrasado, notif_certificados_pendentes, notif_eventos_hoje, notif_eventos_amanha",
      )
      .single(),
  ]);
  const gruposNotificacao = await getContadoresNotificacoes(supabase, {
    notif_financeiro_atrasado: config?.notif_financeiro_atrasado ?? true,
    notif_certificados_pendentes: config?.notif_certificados_pendentes ?? true,
    notif_eventos_hoje: config?.notif_eventos_hoje ?? true,
    notif_eventos_amanha: config?.notif_eventos_amanha ?? true,
  });

  return (
    <div className="admin-dark bg-background text-foreground min-h-svh">
      <SidebarProvider>
        <AdminSidebar user={user} conversasNaoLidas={conversasNaoLidas} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium">Painel administrativo</span>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden w-64 sm:block">
                <BuscaGlobal />
              </div>
              <SinoNotificacoes grupos={gruposNotificacao} />
            </div>
          </header>
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
