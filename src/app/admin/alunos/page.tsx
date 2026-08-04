import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isMinor, type AlunoWithRelations } from "@/lib/alunos/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteAlunoButton } from "@/components/admin/delete-aluno-button";

type AlunoListItem = AlunoWithRelations & {
  matriculas: { status: string; turmas: { nome: string } | null }[];
};

function turmasAtivasLabel(aluno: AlunoListItem) {
  const nomes = aluno.matriculas
    .filter((matricula) => matricula.status === "ativa")
    .map((matricula) => matricula.turmas?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return nomes.length > 0 ? nomes.join(", ") : "—";
}

export default async function AlunosPage() {
  await requireRole("admin");

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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Turmas ativas</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunos.map((aluno) => (
                <TableRow key={aluno.id}>
                  <TableCell className="font-medium">{aluno.profiles?.full_name ?? "—"}</TableCell>
                  <TableCell>{aluno.email}</TableCell>
                  <TableCell>{turmasAtivasLabel(aluno)}</TableCell>
                  <TableCell>
                    {isMinor(aluno.data_nascimento) ? (
                      <Badge variant="secondary">Menor de idade</Badge>
                    ) : (
                      "Maior de idade"
                    )}
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={<Link href={`/admin/alunos/${aluno.id}/editar`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeleteAlunoButton
                      id={aluno.id}
                      nome={aluno.profiles?.full_name ?? aluno.email}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
