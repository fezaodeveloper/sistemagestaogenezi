import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Aula } from "@/lib/aulas/schema";
import type { Modulo } from "@/lib/modulos/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteAulaButton } from "@/components/admin/delete-aula-button";

export default async function AulasPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId } = await params;

  const supabase = await createClient();
  const [{ data: moduloData }, { data, error }] = await Promise.all([
    supabase.from("modulos").select("*").eq("id", moduloId).eq("curso_id", cursoId).single(),
    supabase.from("aulas").select("*").eq("modulo_id", moduloId).order("numero"),
  ]);
  const modulo = moduloData as Modulo | null;
  const aulas = data as Aula[] | null;

  if (!modulo) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/admin/cursos/${cursoId}/modulos`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Módulos
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Aulas</h1>
            <p className="text-muted-foreground text-sm">{modulo.titulo}</p>
          </div>
          <Button
            render={<Link href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/novo`} />}
            nativeButton={false}
          >
            <Plus />
            Nova aula
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as aulas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !aulas || aulas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma aula cadastrada ainda.</p>
            <Button
              render={<Link href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/novo`} />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeira aula
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Número</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aulas.map((aula) => (
                <TableRow key={aula.id}>
                  <TableCell>{aula.numero}</TableCell>
                  <TableCell className="font-medium">{aula.titulo}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={
                        <Link
                          href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aula.id}/quiz`}
                        />
                      }
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Quiz
                    </Button>
                    <Button
                      render={
                        <Link
                          href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aula.id}/materiais`}
                        />
                      }
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Materiais
                    </Button>
                    <Button
                      render={
                        <Link
                          href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aula.id}/editar`}
                        />
                      }
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeleteAulaButton
                      cursoId={cursoId}
                      moduloId={moduloId}
                      aulaId={aula.id}
                      titulo={aula.titulo}
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
