import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatriculasTable, type MatriculaListItem } from "@/components/admin/matriculas-table";

export default async function MatriculasPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("*, alunos(full_name, email, cpf), turmas(nome, vagas_total, vagas_ocupadas, cursos(nome))")
    .order("created_at", { ascending: false });
  const matriculas = data as MatriculaListItem[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Matrículas</h1>
        <p className="text-muted-foreground text-sm">Gerencie as matrículas dos alunos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as matrículas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !matriculas || matriculas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma matrícula cadastrada ainda.</p>
            <Button
              render={<Link href="/admin/matriculas/nova" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Nova matrícula
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <MatriculasTable matriculas={matriculas} />
        </Card>
      )}
    </div>
  );
}
