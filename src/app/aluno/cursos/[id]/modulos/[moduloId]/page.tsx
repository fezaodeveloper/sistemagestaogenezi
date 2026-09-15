import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, PlayCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  alunoTemAcessoAoCurso,
  getExpiracaoMatricula,
  getMatriculaAtivaComTurma,
} from "@/lib/matriculas/access";
import { getLiberacaoAulasCurso, type AulaLiberacao } from "@/lib/cronograma/liberacao";
import { getAulasConcluidasIds } from "@/lib/aulas-concluidas/progresso";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Verde quando o módulo está 100% concluído, âmbar em andamento, cinza
// quando ainda não começou — mesma paleta usada na página de módulos do
// curso (cursos/[id]/page.tsx).
function corIndicadorModulo(percentual: number): string {
  if (percentual >= 100) return "bg-green-500";
  if (percentual > 0) return "bg-amber-500";
  return "bg-muted-foreground/30";
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

type ModuloVizinhoRow = { id: string; numero: number; titulo: string };

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

  const [{ data: moduloData }, { data, error }, matricula, { data: todosModulosData }] =
    await Promise.all([
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
      supabase.from("modulos").select("id, numero, titulo").eq("curso_id", cursoId).order("numero"),
    ]);

  const modulo = moduloData as unknown as ModuloRow | null;
  const aulas = data as unknown as AulaAlunoRow[] | null;
  const todosModulos = (todosModulosData ?? []) as ModuloVizinhoRow[];

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

  // Status de conclusão (✅/⭕) por aula — mesma linguagem visual introduzida
  // na lista de aulas do player (aulas/[aulaId]/page.tsx), pra consistência
  // entre as duas telas.
  const aulasConcluidasIds = await getAulasConcluidasIds(
    supabase,
    (aulas ?? []).map((aula) => aula.id),
    matricula?.id ?? null,
  );

  const totalAulas = aulas?.length ?? 0;
  const concluidas = aulasConcluidasIds.size;
  const percentualModulo = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;
  const moduloConcluido = totalAulas > 0 && concluidas === totalAulas;

  // Primeira aula liberada e ainda não concluída, na ordem do módulo —
  // define tanto o destaque visual ("aula atual") quanto o alvo do botão
  // "Continuar de onde parei".
  const aulaAtual = (aulas ?? []).find((aula) => {
    const liberacao = liberacaoMap.get(aula.id) ?? liberacaoPadrao;
    return liberacao.liberada && !aulasConcluidasIds.has(aula.id);
  });

  const proximoModulo = todosModulos
    .filter((m) => m.numero > modulo.numero)
    .sort((a, b) => a.numero - b.numero)[0];

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            Módulo {modulo.numero} — {modulo.titulo}
          </h1>
          {totalAulas > 0 && (
            <Badge variant="secondary">
              {concluidas}/{totalAulas}
            </Badge>
          )}
        </div>
        {totalAulas > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Progress
                value={percentualModulo}
                className="max-w-xs flex-1"
                indicatorClassName={corIndicadorModulo(percentualModulo)}
              />
              <span className="text-muted-foreground text-sm">
                {concluidas} de {totalAulas} aulas concluídas ({percentualModulo}%)
              </span>
            </div>
            {moduloConcluido && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                🎉 Módulo concluído!
              </p>
            )}
          </div>
        )}
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
        <div className="flex flex-col gap-4">
          {aulaAtual && (
            <Button
              render={
                <Link href={`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaAtual.id}`} />
              }
              nativeButton={false}
              className="w-fit gap-2 bg-cyan-600 text-white hover:bg-cyan-700"
            >
              <PlayCircle className="size-4" />
              Continuar: Aula {aulaAtual.numero} — {aulaAtual.titulo}
            </Button>
          )}

          {moduloConcluido && (
            <Card className="border-cyan-500/30 bg-cyan-500/5">
              <CardContent className="flex items-center justify-between gap-3 py-4">
                {proximoModulo ? (
                  <>
                    <p className="text-sm font-medium">Você concluiu este módulo. Continue para o próximo:</p>
                    <Button
                      render={
                        <Link href={`/aluno/cursos/${cursoId}/modulos/${proximoModulo.id}`} />
                      }
                      nativeButton={false}
                      size="sm"
                      className="shrink-0 gap-2 bg-cyan-600 text-white hover:bg-cyan-700"
                    >
                      Ir para o Módulo {proximoModulo.numero} — {proximoModulo.titulo}
                      <ArrowRight className="size-4" />
                    </Button>
                  </>
                ) : (
                  <p className="text-sm font-medium">
                    🎓 Você concluiu todos os módulos! Aguarde a liberação do seu certificado.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            {aulas.map((aula) => {
              const totalMateriais = aula.materiais?.length ?? 0;
              const temQuiz = !!aula.quizzes;
              const liberacao = liberacaoMap.get(aula.id) ?? liberacaoPadrao;
              const concluida = aulasConcluidasIds.has(aula.id);
              const atual = aulaAtual?.id === aula.id;

              if (!liberacao.liberada) {
                return (
                  <Card key={aula.id} className="opacity-60">
                    <CardContent className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lock className="text-muted-foreground size-4 shrink-0" />
                        <p className="font-medium">
                          {concluida ? "✅" : "⭕"} Aula {aula.numero} — {aula.titulo}
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
                  <Card
                    className={cn(
                      "transition-colors",
                      concluida
                        ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                        : atual
                          ? "border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/15"
                          : "hover:bg-accent/50",
                    )}
                  >
                    <CardContent className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {concluida ? "✅" : "⭕"} Aula {aula.numero} — {aula.titulo}
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
        </div>
      )}
    </div>
  );
}
