import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CURSO_STATUS_LABELS, CURSO_TIPO_LABELS, type Curso } from "@/lib/cursos/schema";
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
import { DeleteCursoButton } from "@/components/admin/delete-curso-button";

export default async function CursosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cursos")
    .select("*")
    .order("created_at", { ascending: false });
  const cursos = data as Curso[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cursos</h1>
          <p className="text-muted-foreground text-sm">Cadastro de cursos oferecidos.</p>
        </div>
        <Button render={<Link href="/admin/cursos/novo" />} nativeButton={false}>
          <Plus />
          Novo curso
        </Button>
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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cursos.map((curso) => (
                <TableRow key={curso.id}>
                  <TableCell className="font-medium">{curso.nome}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CURSO_TIPO_LABELS[curso.tipo]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={curso.status === "ativo" ? "default" : "outline"}>
                      {CURSO_STATUS_LABELS[curso.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={<Link href={`/admin/cursos/${curso.id}/editar`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeleteCursoButton id={curso.id} nome={curso.nome} />
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
