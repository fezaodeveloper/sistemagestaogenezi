import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CursosTable, type CursoListItem } from "@/components/admin/cursos-table";

export default async function CursosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cursos")
    .select("*, modulos(aulas(id))")
    .order("created_at", { ascending: false });
  const cursos = data as CursoListItem[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cursos</h1>
        <p className="text-muted-foreground text-sm">Cadastro de cursos oferecidos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os cursos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !cursos || cursos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum curso cadastrado ainda.</p>
            <Button
              render={<Link href="/admin/cursos/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro curso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <CursosTable cursos={cursos} />
        </Card>
      )}
    </div>
  );
}
