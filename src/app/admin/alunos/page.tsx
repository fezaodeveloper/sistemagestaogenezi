import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlunosTable, type AlunoListItem } from "@/components/admin/alunos-table";

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ criado?: string }>;
}) {
  await requireRole("admin");
  const { criado } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("*, profiles!alunos_id_fkey(full_name), matriculas(status, turmas(nome))")
    .order("created_at", { ascending: false });
  const alunos = data as AlunoListItem[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-muted-foreground text-sm">Cadastro de alunos.</p>
        </div>
        <Button render={<Link href="/admin/alunos/novo" />} nativeButton={false}>
          <Plus />
          Novo aluno
        </Button>
      </div>

      {criado === "1" && (
        <p className="text-muted-foreground text-sm">Aluno cadastrado com sucesso.</p>
      )}

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os alunos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !alunos || alunos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum aluno cadastrado ainda.</p>
            <Button
              render={<Link href="/admin/alunos/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro aluno
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <AlunosTable alunos={alunos} />
        </Card>
      )}
    </div>
  );
}
