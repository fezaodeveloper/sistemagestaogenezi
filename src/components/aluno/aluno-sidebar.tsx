import Link from "next/link";
import { Award, Banknote, Briefcase, Coins, FileBadge, FileText, GraduationCap, MessagesSquare, Trophy, User, Users } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import type { RecursosHabilitados } from "@/lib/configuracoes/recursos";
import { UserMenu } from "@/components/auth/user-menu";
import { PushSubscribeAluno } from "@/components/aluno/push-subscribe";
import { PwaInstallButton } from "@/components/aluno/pwa-install-button";
import { DocumentosLegaisMenu } from "@/components/aluno/documentos-legais-menu";
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

// Cabeçalho da sidebar: logo da escola (versão tema escuro — a área do aluno é sempre escura,
// ver layout.tsx) se cadastrada, senão o nome da escola. Mesmo critério do cabeçalho da sidebar
// do admin (src/components/admin/admin-sidebar.tsx), simplificado — a sidebar do aluno não tem
// modo "recolhida em ícones" (só offcanvas), então não precisa de uma variante de logo pequena.
function CabecalhoSidebar({ logoUrl, nomeEscola }: { logoUrl: string | null; nomeEscola: string }) {
  if (logoUrl) {
    return (
      <div className="flex items-center px-2 py-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto */}
        <img src={logoUrl} alt={`Logo de ${nomeEscola}`} className="h-9 max-w-full object-contain object-left" />
      </div>
    );
  }
  return (
    <div className="flex flex-col px-2 py-1">
      <span className="truncate text-sm font-semibold">{nomeEscola}</span>
      <span className="text-sidebar-foreground/60 text-[10.5px]">Área do Aluno</span>
    </div>
  );
}

export function AlunoSidebar({
  user,
  conversaId,
  mensagensNaoLidas,
  parcelasAtrasadas,
  contratosPendentes,
  recursos,
  conectaHabilitado,
  comunidadeHabilitada,
  conquistasHabilitadas,
  nomeEscola,
  logoUrl,
  vapidPublicKey,
}: {
  user: CurrentUser;
  conversaId: string | null;
  mensagensNaoLidas: number;
  parcelasAtrasadas: number;
  contratosPendentes: number;
  recursos: RecursosHabilitados;
  conectaHabilitado: boolean;
  comunidadeHabilitada: boolean;
  conquistasHabilitadas: boolean;
  nomeEscola: string;
  logoUrl: string | null;
  vapidPublicKey: string | null;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <CabecalhoSidebar logoUrl={logoUrl} nomeEscola={nomeEscola} />
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
              {comunidadeHabilitada && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link href="/aluno/comunidade">
                        <Users />
                        <span>Comunidade</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )}
              {conquistasHabilitadas && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={
                      <Link href="/aluno/conquistas">
                        <Award />
                        <span>Conquistas</span>
                      </Link>
                    }
                  />
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
              {/* Privacidade, Termos, LGPD e Uso de Imagem num submenu único. */}
              <DocumentosLegaisMenu />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
        <PushSubscribeAluno vapidPublicKey={vapidPublicKey} />
        <PwaInstallButton />
      </SidebarFooter>
    </Sidebar>
  );
}
