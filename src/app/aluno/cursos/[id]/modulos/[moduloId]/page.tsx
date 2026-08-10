import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  alunoTemAcessoAoCurso,
  getExpiracaoMatricula,
  getMatriculaAtivaComTurma,
} from "@/lib/matriculas/access";
import { getLiberacaoAulasCurso, type AulaLiberacao } from "@/lib/cronograma/liberacao";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

type ModuloRow = {
  id: string;
  numero: number;
  titulo: string;
  cursos: { nome: string } | null;
};

type AulaAlunoRow = {
  id: string;
  numero: number;
  titulo: string;
  materiais: { id: string }[] | null;
  quizzes: { id: string } | null;
};

export default async function ModuloAulasPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string }>;
}) {
  const user = await requireRole("aluno");
  const { id: cursoId, moduloId } = await params;

  const supabase = await createClient();

  const temAcesso = await alunoTemAcessoAoCurso(supabase, user.id, cursoId);
  if (!temAcesso) {
    notFound();
  }

  const [{ data: moduloData }, { data, error }, matricula] = await Promise.all([
    supabase
      .from("modulos")
      .select("id, numero, titulo, cursos(nome)")
      .eq("id", moduloId)
      .eq("curso_id", cursoId)
      .single(),
    supabase
      .from("aulas")
      .select("id, numero, titulo, materiais(id), quizzes(id)")
      .eq("modulo_id", moduloId)
      .order("numero"),
    getMatriculaAtivaComTurma(supabase, user.id, cursoId),
  ]);

  const modulo = moduloData as unknown as ModuloRow | null;
  const aulas = data as unknown as AulaAlunoRow[] | null;

  if (!modulo) {
    notFound();
  }

  const expiracao = matricula ? await getExpiracaoMatricula(supabase, matricula.id) : null;

  if (expiracao?.expirada) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Button
            render={<Link href={`/aluno/cursos/${cursoId}`} />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
          >
            <ArrowLeft />
            {modulo.cursos?.nome ?? "Curso"}
          </Button>
          <h1 className="text-2xl font-semibold">
            Módulo {modulo.numero} — {modulo.titulo}
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Lock className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">
              Acesso expirado em {formatDateBR(expiracao.dataExpiracao)}. Fale com a administração
              para renovar o acesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const liberacaoMap = matricula
    ? await getLiberacaoAulasCurso(supabase, cursoId, matricula.turmaId)
    : new Map<string, AulaLiberacao>();
  const liberacaoPadrao: AulaLiberacao = {
    liberada: true,
    motivoBloqueio: null,
    dataLiberacao: null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/aluno/cursos/${cursoId}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          {modulo.cursos?.nome ?? "Curso"}
        </Button>
        <h1 className="text-2xl font-semibold">
          Módulo {modulo.numero} — {modulo.titulo}
        </h1>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as aulas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !aulas || aulas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma aula disponível para este módulo ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {aulas.map((aula) => {
            const totalMateriais = aula.materiais?.length ?? 0;
            const temQuiz = !!aula.quizzes;
            const liberacao = liberacaoMap.get(aula.id) ?? liberacaoPadrao;

            if (!liberacao.liberada) {
              return (
                <Card key={aula.id} className="opacity-60">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="text-muted-foreground size-4 shrink-0" />
                      <p className="font-medium">
                        Aula {aula.numero} — {aula.titulo}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {liberacao.motivoBloqueio === "sequencial"
                        ? "Conclua a aula anterior"
                        : `Disponível em ${formatDateBR(liberacao.dataLiberacao!)}`}
                    </p>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Link
                key={aula.id}
                href={`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aula.id}`}
              >
                <Card className="hover:bg-accent/50 transition-colors">
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      Aula {aula.numero} — {aula.titulo}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {totalMateriais > 0 && (
                        <Badge variant="secondary">
                          {totalMateriais} {totalMateriais === 1 ? "material" : "materiais"}
                        </Badge>
                      )}
                      {temQuiz && <Badge variant="default">Quiz disponível</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
