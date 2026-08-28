import Link from "next/link";
import { Banknote, Coins, FileBadge, GraduationCap, MessagesSquare, Trophy, User } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import { UserMenu } from "@/components/auth/user-menu";
import { BadgeChatNaoLidas } from "@/components/chat/badge-chat-nao-lidas";
import { getContagemNaoLidasAlunoAction } from "@/lib/chat/badge-actions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AlunoSidebar({
  user,
  conversaId,
  mensagensNaoLidas,
  parcelasAtrasadas,
}: {
  user: CurrentUser;
  conversaId: string | null;
  mensagensNaoLidas: number;
  parcelasAtrasadas: number;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <span className="px-2 py-1 text-sm font-semibold">Área do Aluno</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno">
                      <GraduationCap />
                      <span>Meus Cursos</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/financeiro">
                      <Banknote />
                      <span>Financeiro</span>
                    </Link>
                  }
                />
                {parcelasAtrasadas > 0 && (
                  <SidebarMenuBadge className="bg-destructive text-white">
                    {parcelasAtrasadas}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/mensagens">
                      <MessagesSquare />
                      <span>Mensagens</span>
                    </Link>
                  }
                />
                {conversaId && (
                  <BadgeChatNaoLidas
                    key={mensagensNaoLidas}
                    initialCount={mensagensNaoLidas}
                    realtimeFilter={`conversa_id=eq.${conversaId}`}
                    refetchAction={getContagemNaoLidasAlunoAction.bind(null, conversaId)}
                  />
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/ranking">
                      <Trophy />
                      <span>Ranking</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/perfil">
                      <User />
                      <span>Meu Perfil</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/creditos">
                      <Coins />
                      <span>Créditos</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/certificados">
                      <FileBadge />
                      <span>Certificados</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
