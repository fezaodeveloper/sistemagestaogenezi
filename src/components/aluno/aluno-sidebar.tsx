import Link from "next/link";
import { Banknote, Briefcase, Coins, FileBadge, FileText, GraduationCap, MessagesSquare, Trophy, User } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import type { RecursosHabilitados } from "@/lib/configuracoes/recursos";
import { UserMenu } from "@/components/auth/user-menu";
import { PushSubscribeAluno } from "@/components/aluno/push-subscribe";
import { PwaInstallButton } from "@/components/aluno/pwa-install-button";
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
  contratosPendentes,
  recursos,
  conectaHabilitado,
  vapidPublicKey,
}: {
  user: CurrentUser;
  conversaId: string | null;
  mensagensNaoLidas: number;
  parcelasAtrasadas: number;
  contratosPendentes: number;
  recursos: RecursosHabilitados;
  conectaHabilitado: boolean;
  vapidPublicKey: string | null;
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
              {recursos.chat && (
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
              )}
              {recursos.ranking && (
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
              )}
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
              {recursos.premios && (
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
              )}
              {conectaHabilitado && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link href="/aluno/conecta">
                        <Briefcase />
                        <span>Gênezi Conecta</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )}
              {recursos.certificados && (
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
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/aluno/contrato">
                      <FileText />
                      <span>Meu Contrato</span>
                    </Link>
                  }
                />
                {contratosPendentes > 0 && (
                  <SidebarMenuBadge className="bg-destructive text-white">
                    {contratosPendentes}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
        <nav className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 px-2 pb-1 text-[11px] text-muted-foreground/70">
          <Link href="/aluno/legal/privacidade" className="hover:text-muted-foreground hover:underline">
            Privacidade
          </Link>
          <span aria-hidden>·</span>
          <Link href="/aluno/legal/termos" className="hover:text-muted-foreground hover:underline">
            Termos
          </Link>
          <span aria-hidden>·</span>
          <Link href="/aluno/legal/lgpd" className="hover:text-muted-foreground hover:underline">
            LGPD
          </Link>
          <span aria-hidden>·</span>
          <Link href="/aluno/legal/imagem" className="hover:text-muted-foreground hover:underline">
            Uso de Imagem
          </Link>
        </nav>
        <PushSubscribeAluno vapidPublicKey={vapidPublicKey} />
        <PwaInstallButton />
      </SidebarFooter>
    </Sidebar>
  );
}
