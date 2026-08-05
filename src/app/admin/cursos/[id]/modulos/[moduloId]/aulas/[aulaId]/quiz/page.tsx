import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Aula } from "@/lib/aulas/schema";
import type { Quiz } from "@/lib/quizzes/schema";
import { QUESTAO_TIPO_LABELS, type QuestaoWithAlternativas } from "@/lib/questoes/schema";
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
import { QuizForm } from "@/components/admin/quiz-form";
import { DeleteQuizButton } from "@/components/admin/delete-quiz-button";
import { DeleteQuestaoButton } from "@/components/admin/delete-questao-button";
import {
  createQuiz,
  updateQuiz,
} from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/quiz/actions";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, aulaId } = await params;

  const supabase = await createClient();
  const [{ data: aulaData }, { data: quizData }] = await Promise.all([
    supabase.from("aulas").select("*").eq("id", aulaId).eq("modulo_id", moduloId).single(),
    supabase.from("quizzes").select("*").eq("aula_id", aulaId).maybeSingle(),
  ]);
  const aula = aulaData as Aula | null;
  const quiz = quizData as Quiz | null;

  if (!aula) {
    notFound();
  }

  const aulasHref = `/admin/cursos/${cursoId}/modulos/${moduloId}/aulas`;

  let questoes: QuestaoWithAlternativas[] | null = null;
  let questoesError = false;
  if (quiz) {
    const { data, error } = await supabase
      .from("questoes")
      .select("*, alternativas(*)")
      .eq("quiz_id", quiz.id)
      .order("ordem")
      .order("ordem", { referencedTable: "alternativas" });
    questoes = data as unknown as QuestaoWithAlternativas[] | null;
    questoesError = Boolean(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={aulasHref} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Aulas
        </Button>
        <h1 className="text-2xl font-semibold">Quiz</h1>
        <p className="text-muted-foreground text-sm">{aula.titulo}</p>
      </div>

      {!quiz ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Criar quiz para esta aula</CardTitle>
          </CardHeader>
          <CardContent>
            <QuizForm
              action={createQuiz.bind(null, cursoId, moduloId, aulaId)}
              submitLabel="Criar quiz"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="max-w-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configurações</CardTitle>
              <DeleteQuizButton
                cursoId={cursoId}
                moduloId={moduloId}
                aulaId={aulaId}
                quizId={quiz.id}
                titulo={quiz.titulo}
              />
            </CardHeader>
            <CardContent>
              <QuizForm
                action={updateQuiz.bind(null, cursoId, moduloId, aulaId, quiz.id)}
                defaultValues={{
                  titulo: quiz.titulo,
                  nota_minima_ativa: quiz.nota_minima_ativa,
                  nota_minima_percentual: quiz.nota_minima_percentual ?? undefined,
                  tentativas_limitadas: quiz.tentativas_limitadas,
                  tentativas_maximas: quiz.tentativas_maximas ?? undefined,
                }}
                submitLabel="Salvar alterações"
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Questões</h2>
            <Button
              render={
                <Link
                  href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz/questoes/novo`}
                />
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
                      href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz/questoes/novo`}
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
                              href={`/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz/questoes/${questao.id}/editar`}
                            />
                          }
                          nativeButton={false}
                          variant="ghost"
                          size="sm"
                        >
                          Editar
                        </Button>
                        <DeleteQuestaoButton
                          cursoId={cursoId}
                          moduloId={moduloId}
                          aulaId={aulaId}
                          questaoId={questao.id}
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
