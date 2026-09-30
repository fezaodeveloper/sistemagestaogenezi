import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getContagemConversasNaoLidasAdmin } from "@/lib/chat/chat";
import { getContadoresNotificacoes } from "@/lib/admin/notificacoes";
import { getPendencias } from "@/app/admin/pendencias/actions";
import { getLogosEscola } from "@/lib/personalizacao/logos";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SinoNotificacoes } from "@/components/admin/sino-notificacoes";
import { BuscaGlobal } from "@/components/admin/busca-global";
import { BalaoAcessoRemoto } from "@/components/admin/balao-acesso-remoto";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área do gestor: tema dark Genezi (redesign aprovado - design-reference v3)
// (decisão de produto — ver CLAUDE.md).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  const supabase = await createClient();
  const [conversasNaoLidas, { data: config }, pendencias, logos] = await Promise.all([
    getContagemConversasNaoLidasAdmin(supabase),
    supabase
      .from("configuracoes")
      .select(
        "notif_financeiro_atrasado, notif_certificados_pendentes, notif_eventos_hoje, notif_eventos_amanha",
      )
      .single(),
    // requireRole() usa cache() do React — chamar de novo dentro de
    // getPendencias() não duplica a query de sessão (ver comentário lá).
    getPendencias(),
    // Logos da escola pra sidebar (nunca lança; sem logo, o cabeçalho de sempre).
    getLogosEscola(supabase),
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
        <AdminSidebar user={user} conversasNaoLidas={conversasNaoLidas} pendenciasCount={pendencias.length} logos={logos} />
        {/* min-w-0: SidebarInset é item de um flex row (o wrapper do SidebarProvider). Sem isso,
            o default min-width:auto do flex faz este item nunca encolher abaixo da largura
            mínima do CONTEÚDO — e agora que as tabelas internas têm min-w grande (ver
            matriculas-table.tsx/alunos-table.tsx/turmas-table.tsx), esse conteúdo "empurra" o
            <main> inteiro (e a página toda) pra além da viewport, em vez de ficar confinado no
            overflow-x-auto próprio da tabela. Sintoma exato do bug relatado: rolagem "trava na
            metade" porque quem realmente cresce sem limite é o layout, não só a tabela. */}
        <SidebarInset className="min-w-0">
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
      {/* Balão flutuante de acesso remoto (fixo, só no painel admin). */}
      <BalaoAcessoRemoto />
    </div>
  );
}
