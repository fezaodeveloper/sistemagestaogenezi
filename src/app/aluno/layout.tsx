import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { AlunoSidebar } from "@/components/aluno/aluno-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área do aluno: tema escuro forçado, independente de preferência do sistema
// (decisão de produto — ver CLAUDE.md).
export default async function AlunoLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("aluno");

  return (
    <div className="dark bg-background text-foreground min-h-svh">
      <SidebarProvider>
        <AlunoSidebar user={user} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium">Área do aluno</span>
          </header>
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
