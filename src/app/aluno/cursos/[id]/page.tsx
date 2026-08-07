import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { alunoTemAcessoAoCurso } from "@/lib/matriculas/access";
import { getCursoProgresso } from "@/lib/aulas-concluidas/progresso";
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CursoTipo = (typeof CURSO_TIPOS)[number];

type ModuloAlunoRow = {
  id: string;
  numero: number;
  titulo: string;
  aulas: { id: string }[] | null;
  provas: { id: string } | null;
};

export default async function CursoModulosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("aluno");
  const { id: cursoId } = await params;

  const supabase = await createClient();

  const temAcesso = await alunoTemAcessoAoCurso(supabase, user.id, cursoId);
  if (!temAcesso) {
    notFound();
  }

  const [{ data: cursoData }, { data, error }, progresso] = await Promise.all([
    supabase.from("cursos").select("id, nome, tipo").eq("id", cursoId).single(),
    supabase
      .from("modulos")
      .select("id, numero, titulo, aulas(id), provas(id)")
      .eq("curso_id", cursoId)
      .order("numero"),
    getCursoProgresso(supabase, cursoId),
  ]);

  const percentual =
    progresso.total > 0 ? Math.round((progresso.concluidas / progresso.total) * 100) : 0;

  const curso = cursoData as { id: string; nome: string; tipo: CursoTipo } | null;
  const modulos = data as unknown as ModuloAlunoRow[] | null;

  if (!curso) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href="/aluno" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Meus Cursos
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{curso.nome}</h1>
          <Badge variant="secondary">{CURSO_TIPO_LABELS[curso.tipo]}</Badge>
        </div>
        {progresso.total > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <Progress value={percentual} className="max-w-xs flex-1" />
            <span className="text-muted-foreground text-sm">
              {progresso.concluidas}/{progresso.total} aulas concluídas
            </span>
          </div>
        )}
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os módulos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !modulos || modulos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum módulo disponível para este curso ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((modulo) => {
            const totalAulas = modulo.aulas?.length ?? 0;
            const temProva = !!modulo.provas;

            return (
              <Link key={modulo.id} href={`/aluno/cursos/${cursoId}/modulos/${modulo.id}`}>
                <Card className="hover:bg-accent/50 transition-colors">
                  <CardHeader>
                    <CardTitle>
                      Módulo {modulo.numero} — {modulo.titulo}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {totalAulas} {totalAulas === 1 ? "aula" : "aulas"}
                    </Badge>
                    {temProva && <Badge variant="default">Prova disponível</Badge>}
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
