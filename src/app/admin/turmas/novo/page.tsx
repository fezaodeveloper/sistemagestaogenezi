import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TurmaForm } from "@/components/admin/turma-form";
import { createTurma } from "@/app/admin/turmas/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function NovaTurmaPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: cursos } = await supabase
    .from("cursos")
    .select("id, nome, tipo")
    .eq("status", "ativo")
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova turma</h1>
        <p className="text-muted-foreground text-sm">Cadastre uma turma para um curso ativo.</p>
      </div>

      {!cursos || cursos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum curso ativo encontrado. Cadastre ou reative um curso antes de criar uma turma.
            </p>
            <Button
              render={<Link href="/admin/cursos/novo" />}
              nativeButton={false}
              variant="outline"
            >
              Ir para cursos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TurmaForm action={createTurma} submitLabel="Criar turma" cursos={cursos} />
      )}
    </div>
  );
}
