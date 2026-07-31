import { requireRole } from "@/lib/auth/dal";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel</h1>
        <p className="text-muted-foreground text-sm">Bem-vindo, {user.full_name ?? user.email}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Esta é a base protegida do painel administrativo — os módulos de gestão (alunos, cursos,
            financeiro...) entram nas próximas fases.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
