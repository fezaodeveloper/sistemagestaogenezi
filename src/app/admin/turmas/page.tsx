import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { TurmaWithCurso } from "@/lib/turmas/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TurmasTable } from "@/components/admin/turmas-table";

export default async function TurmasPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("*, cursos(nome)")
    .order("created_at", { ascending: false });
  const turmas = data as TurmaWithCurso[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Turmas</h1>
        <p className="text-muted-foreground text-sm">Turmas vinculadas aos cursos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as turmas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !turmas || turmas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma turma cadastrada ainda.</p>
            <Button
              render={<Link href="/admin/turmas/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeira turma
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <TurmasTable turmas={turmas} />
        </Card>
      )}
    </div>
  );
}
