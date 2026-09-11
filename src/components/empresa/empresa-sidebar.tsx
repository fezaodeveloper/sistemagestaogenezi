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
}: {
  user: CurrentUser;
  notificacoesNaoLidas: number;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <span className="px-2 py-1 text-sm font-semibold">GÊNEZI Conecta</span>
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
