import type { ReactNode } from "react";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaPorProfileId, getContagemNotificacoesNaoLidas } from "@/lib/conecta/empresas";
import { EmpresaSidebar } from "@/components/empresa/empresa-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área da empresa: mesmo tema escuro forçado da área do aluno (decisão de
// produto — ver CLAUDE.md).
export default async function EmpresaLayout({ children }: { children: ReactNode }) {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  const notificacoesNaoLidas = empresa
    ? await getContagemNotificacoesNaoLidas(supabase, empresa.id)
    : 0;

  return (
    <div className="dark bg-background text-foreground min-h-svh">
      <SidebarProvider>
        <EmpresaSidebar user={user} notificacoesNaoLidas={notificacoesNaoLidas} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium">Área da empresa</span>
          </header>
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
