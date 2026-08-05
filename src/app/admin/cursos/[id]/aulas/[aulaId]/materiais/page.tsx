import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { MATERIAL_TIPO_LABELS, type Material } from "@/lib/materiais/schema";
import type { Aula } from "@/lib/aulas/schema";
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
import { DeleteMaterialButton } from "@/components/admin/delete-material-button";

export default async function MateriaisPage({
  params,
}: {
  params: Promise<{ id: string; aulaId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, aulaId } = await params;

  const supabase = await createClient();
  const [{ data: aulaData }, { data, error }] = await Promise.all([
    supabase.from("aulas").select("*").eq("id", aulaId).eq("curso_id", cursoId).single(),
    supabase.from("materiais").select("*").eq("aula_id", aulaId).order("ordem"),
  ]);
  const aula = aulaData as Aula | null;
  const materiais = data as Material[] | null;

  if (!aula) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/admin/cursos/${cursoId}/aulas`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Aulas
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Materiais</h1>
            <p className="text-muted-foreground text-sm">{aula.titulo}</p>
          </div>
          <Button
            render={<Link href={`/admin/cursos/${cursoId}/aulas/${aulaId}/materiais/novo`} />}
            nativeButton={false}
          >
            <Plus />
            Novo material
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os materiais. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !materiais || materiais.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum material cadastrado ainda.</p>
            <Button
              render={<Link href={`/admin/cursos/${cursoId}/aulas/${aulaId}/materiais/novo`} />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro material
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiais.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>{material.ordem}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{MATERIAL_TIPO_LABELS[material.tipo]}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {material.titulo}
                      {material.tipo !== "pdf" && (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Abrir ${material.titulo}`}
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={
                        <Link
                          href={`/admin/cursos/${cursoId}/aulas/${aulaId}/materiais/${material.id}/editar`}
                        />
                      }
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeleteMaterialButton cursoId={cursoId} aulaId={aulaId} material={material} />
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
