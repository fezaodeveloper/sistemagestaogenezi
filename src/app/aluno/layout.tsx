import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getConversaPorAluno, getContagemNaoLidasAluno } from "@/lib/chat/chat";
import { dispararEvento } from "@/lib/automacoes/motor";
import { verificarBadgesProgressivos } from "@/lib/gamificacao/badges-progressivos";
import { AlunoSidebar } from "@/components/aluno/aluno-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Área do aluno: tema escuro forçado, independente de preferência do sistema
// (decisão de produto — ver CLAUDE.md).
export default async function AlunoLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("aluno");

  // Best-effort — idempotency_key com a data garante no máximo 1
  // notificação por aluno por dia, mesmo que esse layout rode a cada
  // navegação dentro de /aluno (não só no login em si).
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    await dispararEvento(
      "aluno.login",
      { nome_aluno: user.full_name ?? user.email, email: user.email },
      `aluno-login-${user.id}-${hoje}`,
    );
  } catch {
    // Nunca deve impedir o aluno de acessar a própria área.
  }

  // Best-effort — roda em toda navegação dentro de /aluno (não só no login
  // em si), mas concederBadges usa upsert com ignoreDuplicates, então
  // rodar de novo pra um badge já concedido é inofensivo (só idempotente).
  try {
    await verificarBadgesProgressivos(user.id);
  } catch {
    // Nunca deve impedir o aluno de acessar a própria área.
  }

  const supabase = await createClient();
  const [conversa, { count: parcelasAtrasadas }, { count: contratosPendentes }] = await Promise.all([
    getConversaPorAluno(supabase, user.id),
    supabase
      .from("parcelas")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", user.id)
      .eq("status", "atrasado"),
    supabase
      .from("contratos_assinados")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", user.id)
      .eq("status", "pendente"),
  ]);
  const mensagensNaoLidas = conversa
    ? await getContagemNaoLidasAluno(supabase, conversa.id, user.id)
    : 0;

  return (
    <div className="dark bg-background text-foreground min-h-svh">
      <SidebarProvider>
        <AlunoSidebar
          user={user}
          conversaId={conversa?.id ?? null}
          mensagensNaoLidas={mensagensNaoLidas}
          parcelasAtrasadas={parcelasAtrasadas ?? 0}
          contratosPendentes={contratosPendentes ?? 0}
        />
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
