import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  alunoTemAcessoAoCurso,
  getExpiracaoMatricula,
  getMatriculaIdAtivaParaCurso,
} from "@/lib/matriculas/access";
import { getCursoProgresso } from "@/lib/aulas-concluidas/progresso";
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { CursoCapa } from "@/components/aluno/curso-capa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CursoTipo = (typeof CURSO_TIPOS)[number];

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

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

  const [{ data: cursoData }, matriculaId] = await Promise.all([
    supabase.from("cursos").select("id, nome, tipo, capa_url").eq("id", cursoId).single(),
    getMatriculaIdAtivaParaCurso(supabase, user.id, cursoId),
  ]);

  const curso = cursoData as { id: string; nome: string; tipo: CursoTipo; capa_url: string | null } | null;

  if (!curso) {
    notFound();
  }

  const capaUrl = curso.capa_url
    ? supabase.storage.from("cursos").getPublicUrl(curso.capa_url).data.publicUrl
    : null;

  const expiracao = matriculaId ? await getExpiracaoMatricula(supabase, matriculaId) : null;

  if (expiracao?.expirada) {
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
          <div className="flex gap-4">
            <CursoCapa capaUrl={capaUrl} nome={curso.nome} className="w-28 shrink-0 sm:w-36" />
            <h1 className="text-2xl font-semibold">{curso.nome}</h1>
          </div>
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

  const [{ data, error }, progresso] = await Promise.all([
    supabase
      .from("modulos")
      .select("id, numero, titulo, aulas(id), provas(id)")
      .eq("curso_id", cursoId)
      .order("numero"),
    getCursoProgresso(supabase, cursoId),
  ]);

  const percentual =
    progresso.total > 0 ? Math.round((progresso.concluidas / progresso.total) * 100) : 0;

  const modulos = data as unknown as ModuloAlunoRow[] | null;

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
        <div className="flex gap-4">
          <CursoCapa capaUrl={capaUrl} nome={curso.nome} className="w-28 shrink-0 sm:w-36" />
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{curso.nome}</h1>
              <Badge variant="secondary">{CURSO_TIPO_LABELS[curso.tipo]}</Badge>
            </div>
            {progresso.total > 0 && (
              <div className="flex items-center gap-3">
                <Progress value={percentual} className="max-w-xs flex-1" />
                <span className="text-muted-foreground text-sm">
                  {progresso.concluidas}/{progresso.total} aulas concluídas
                </span>
              </div>
            )}
          </div>
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
