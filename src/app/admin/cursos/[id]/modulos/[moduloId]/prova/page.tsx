import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Modulo } from "@/lib/modulos/schema";
import type { Prova } from "@/lib/provas/schema";
import { QUESTAO_TIPO_LABELS } from "@/lib/questoes/schema";
import type { QuestaoProvaWithAlternativas } from "@/lib/questoes-prova/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProvaForm } from "@/components/admin/prova-form";
import { DeleteProvaButton } from "@/components/admin/delete-prova-button";
import { DeleteQuestaoProvaButton } from "@/components/admin/delete-questao-prova-button";
import { createProva, updateProva } from "@/app/admin/cursos/[id]/modulos/[moduloId]/prova/actions";

export default async function ProvaPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId } = await params;

  const supabase = await createClient();
  const [{ data: moduloData }, { data: provaData }] = await Promise.all([
    supabase.from("modulos").select("*").eq("id", moduloId).eq("curso_id", cursoId).single(),
    supabase.from("provas").select("*").eq("modulo_id", moduloId).maybeSingle(),
  ]);
  const modulo = moduloData as Modulo | null;
  const prova = provaData as Prova | null;

  if (!modulo) {
    notFound();
  }

  const modulosHref = `/admin/cursos/${cursoId}/modulos`;

  let questoes: QuestaoProvaWithAlternativas[] | null = null;
  let questoesError = false;
  if (prova) {
    const { data, error } = await supabase
      .from("questoes_prova")
      .select("*, alternativas:alternativas_prova(*)")
      .eq("prova_id", prova.id)
      .order("ordem")
      .order("ordem", { referencedTable: "alternativas_prova" });
    questoes = data as unknown as QuestaoProvaWithAlternativas[] | null;
    questoesError = Boolean(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={modulosHref} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Módulos
        </Button>
        <h1 className="text-2xl font-semibold">Prova</h1>
        <p className="text-muted-foreground text-sm">{modulo.titulo}</p>
      </div>

      {!prova ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Criar prova para este módulo</CardTitle>
          </CardHeader>
          <CardContent>
            <ProvaForm
              action={createProva.bind(null, cursoId, moduloId)}
              submitLabel="Criar prova"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="max-w-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configurações</CardTitle>
              <DeleteProvaButton
                cursoId={cursoId}
                moduloId={moduloId}
                provaId={prova.id}
                titulo={prova.titulo}
              />
            </CardHeader>
            <CardContent>
              <ProvaForm
                action={updateProva.bind(null, cursoId, moduloId, prova.id)}
                defaultValues={{
                  titulo: prova.titulo,
                  nota_minima_ativa: prova.nota_minima_ativa,
                  nota_minima_percentual: prova.nota_minima_percentual ?? undefined,
                  tentativas_limitadas: prova.tentativas_limitadas,
                  tentativas_maximas: prova.tentativas_maximas ?? undefined,
                }}
                submitLabel="Salvar alterações"
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Questões</h2>
            <Button
              render={
                <Link href={`/admin/cursos/${cursoId}/modulos/${moduloId}/prova/questoes/novo`} />
              }
              nativeButton={false}
            >
              <Plus />
              Nova questão
            </Button>
          </div>

          {questoesError ? (
            <Card>
              <CardContent className="text-destructive py-10 text-center text-sm">
                Não foi possível carregar as questões. Tente recarregar a página.
              </CardContent>
            </Card>
          ) : !questoes || questoes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <p className="text-muted-foreground text-sm">Nenhuma questão cadastrada ainda.</p>
                <Button
                  render={
                    <Link
                      href={`/admin/cursos/${cursoId}/modulos/${moduloId}/prova/questoes/novo`}
                    />
                  }
                  nativeButton={false}
                  variant="outline"
                >
                  <Plus />
                  Cadastrar primeira questão
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
                    <TableHead>Enunciado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questoes.map((questao) => (
                    <TableRow key={questao.id}>
                      <TableCell>{questao.ordem}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{QUESTAO_TIPO_LABELS[questao.tipo]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate font-medium">
                        {questao.enunciado}
                      </TableCell>
                      <TableCell className="flex justify-end gap-1">
                        <Button
                          render={
                            <Link
                              href={`/admin/cursos/${cursoId}/modulos/${moduloId}/prova/questoes/${questao.id}/editar`}
                            />
                          }
                          nativeButton={false}
                          variant="ghost"
                          size="sm"
                        >
                          Editar
                        </Button>
                        <DeleteQuestaoProvaButton
                          cursoId={cursoId}
                          moduloId={moduloId}
                          questaoProvaId={questao.id}
                          enunciado={questao.enunciado}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
