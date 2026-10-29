import Link from "next/link";
import { Bell, Briefcase, LayoutDashboard, User, Users } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import { UserMenu } from "@/components/auth/user-menu";
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

export function EmpresaSidebar({
  user,
  notificacoesNaoLidas,
  logoUrl,
}: {
  user: CurrentUser;
  notificacoesNaoLidas: number;
  logoUrl: string | null;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL externa (Storage), fora do domínio otimizado pelo next/image sem configurar remotePatterns
          <img src={logoUrl} alt="Gênezi" className="h-10 w-auto object-contain px-2 py-1" />
        ) : (
          <span className="px-2 py-1 text-sm font-semibold">GÊNEZI Conecta</span>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/empresa/painel">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/empresa/vagas">
                      <Briefcase />
                      <span>Minhas vagas</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/empresa/candidatos">
                      <Users />
                      <span>Candidatos</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/empresa/notificacoes">
                      <Bell />
                      <span>Notificações</span>
                    </Link>
                  }
                />
                {notificacoesNaoLidas > 0 && (
                  <SidebarMenuBadge className="bg-destructive text-white">
                    {notificacoesNaoLidas}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/empresa/perfil">
                      <User />
                      <span>Meu perfil</span>
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
