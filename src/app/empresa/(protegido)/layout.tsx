import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaPorProfileId, getContagemNotificacoesNaoLidas } from "@/lib/conecta/empresas";
import { EmpresaBottomNav } from "@/components/empresa/empresa-bottom-nav";
import { EmpresaSidebar } from "@/components/empresa/empresa-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área da empresa: mesmo tema escuro forçado da área do aluno (decisão de
// produto — ver CLAUDE.md).
export default async function EmpresaLayout({ children }: { children: ReactNode }) {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const admin = createAdminClient();
  const [empresa, { data: configuracoes }] = await Promise.all([
    getEmpresaPorProfileId(supabase, user.id),
    admin.from("configuracoes").select("escola_logo_url").eq("id", true).maybeSingle(),
  ]);

  // TAREFA: empresa deixou de ser gratuita — sem assinatura ativa, nem a aprovação do admin
  // (empresa.status, checada em cada page.tsx/action à parte) libera o portal. Empresas já
  // aprovadas no modelo antigo foram migradas pra assinatura_status='ativa' na migration
  // 20261030100000_empresa_assinatura.sql, então não são afetadas por este redirect.
  if (empresa && empresa.assinatura_status !== "ativa") {
    redirect("/empresa/aguardando-pagamento");
  }

  const notificacoesNaoLidas = empresa
    ? await getContagemNotificacoesNaoLidas(supabase, empresa.id)
    : 0;
  const logoUrl = configuracoes?.escola_logo_url ?? null;

  return (
    <div className="dark bg-background text-foreground min-h-svh">
      <SidebarProvider>
        <EmpresaSidebar user={user} notificacoesNaoLidas={notificacoesNaoLidas} logoUrl={logoUrl} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="md:inline-flex" />
            <Separator orientation="vertical" className="hidden h-4 md:block" />
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa (Storage), fora do domínio otimizado pelo next/image sem configurar remotePatterns
              <img src={logoUrl} alt="Gênezi" className="h-8 w-auto object-contain md:hidden" />
            ) : (
              <span className="text-sm font-medium md:hidden">GÊNEZI Conecta</span>
            )}
            <span className="hidden text-sm font-medium md:inline">Área da empresa</span>
          </header>
          <div className="flex-1 p-6 pb-20 md:pb-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <EmpresaBottomNav notificacoesNaoLidas={notificacoesNaoLidas} />
    </div>
  );
}
