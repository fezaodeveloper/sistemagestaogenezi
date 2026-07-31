import { requireRole } from "@/lib/auth/dal";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AlunoDashboardPage() {
  const user = await requireRole("aluno");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus Cursos</h1>
        <p className="text-muted-foreground text-sm">Bem-vindo, {user.full_name ?? user.email}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Esta é a base protegida do portal do aluno — os cursos, aulas e progresso entram nas
            próximas fases.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
