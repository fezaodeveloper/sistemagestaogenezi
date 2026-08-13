import Link from "next/link";
import {
  Award,
  FileBadge,
  Gift,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AdminSidebar({ user }: { user: CurrentUser }) {
  return (
    <Sidebar>
      <SidebarHeader>
        <span className="px-2 py-1 text-sm font-semibold">Genezi — Gestão</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin">
                      <LayoutDashboard />
                      <span>Painel</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/cursos">
                      <GraduationCap />
                      <span>Cursos</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/turmas">
                      <Users />
                      <span>Turmas</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/alunos">
                      <IdCard />
                      <span>Alunos</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/premios">
                      <Gift />
                      <span>Prêmios</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/resgates">
                      <Award />
                      <span>Resgates</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/certificados">
                      <FileBadge />
                      <span>Certificados</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/mensagens">
                      <MessageCircle />
                      <span>Mensagens</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link href="/admin/configuracoes">
                      <Settings />
                      <span>Configurações</span>
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
