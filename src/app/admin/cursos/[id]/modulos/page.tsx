import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Modulo } from "@/lib/modulos/schema";
import type { Curso } from "@/lib/cursos/schema";
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
import { DeleteModuloButton } from "@/components/admin/delete-modulo-button";

export default async function ModulosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id: cursoId } = await params;

  const supabase = await createClient();
  const [{ data: cursoData }, { data, error }] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", cursoId).single(),
    supabase.from("modulos").select("*").eq("curso_id", cursoId).order("numero"),
  ]);
  const curso = cursoData as Curso | null;
  const modulos = data as Modulo[] | null;

  if (!curso) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href="/admin/cursos" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Cursos
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Módulos</h1>
            <p className="text-muted-foreground text-sm">{curso.nome}</p>
          </div>
          <Button
            render={<Link href={`/admin/cursos/${cursoId}/modulos/novo`} />}
            nativeButton={false}
          >
            <Plus />
            Novo módulo
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os módulos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !modulos || modulos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum módulo cadastrado ainda.</p>
            <Button
              render={<Link href={`/admin/cursos/${cursoId}/modulos/novo`} />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro módulo
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
              {modulos.map((modulo) => (
                <TableRow key={modulo.id}>
                  <TableCell>{modulo.numero}</TableCell>
                  <TableCell className="font-medium">{modulo.titulo}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={<Link href={`/admin/cursos/${cursoId}/modulos/${modulo.id}/aulas`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Aulas
                    </Button>
                    <Button
                      render={<Link href={`/admin/cursos/${cursoId}/modulos/${modulo.id}/prova`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Prova
                    </Button>
                    <Button
                      render={
                        <Link href={`/admin/cursos/${cursoId}/modulos/${modulo.id}/editar`} />
                      }
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeleteModuloButton
                      cursoId={cursoId}
                      moduloId={modulo.id}
                      titulo={modulo.titulo}
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
