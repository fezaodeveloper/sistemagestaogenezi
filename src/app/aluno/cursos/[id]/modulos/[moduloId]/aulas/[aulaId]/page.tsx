import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { alunoTemAcessoAoCurso, getMatriculaIdAtivaParaCurso } from "@/lib/matriculas/access";
import { extractYoutubeVideoId } from "@/lib/materiais/youtube";
import { PdfViewerButton } from "@/components/aluno/pdf-viewer-button";
import { ToggleAulaConcluidaButton } from "@/components/aluno/toggle-aula-concluida-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type AulaRow = {
  id: string;
  numero: number;
  titulo: string;
  modulo_id: string;
  modulos: { id: string; numero: number; titulo: string; curso_id: string } | null;
};

type NextAula = { moduloId: string; aulaId: string } | null;

type PdfMaterialView = { id: string; titulo: string };

// Só busca id/título aqui — a signed URL é gerada sob demanda (Server
// Action `getPdfSignedUrl`, ver actions.ts) quando o aluno abre o modal de
// um material específico, não no carregamento da página.
async function getPdfMateriais(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aulaId: string,
): Promise<{ pdfs: PdfMaterialView[]; error: boolean }> {
  const { data, error } = await supabase
    .from("materiais")
    .select("id, titulo")
    .eq("aula_id", aulaId)
    .eq("tipo", "pdf")
    .order("ordem");

  if (error) {
    return { pdfs: [], error: true };
  }

  return { pdfs: (data ?? []) as PdfMaterialView[], error: false };
}

type QuizResumo = {
  id: string;
  titulo: string;
  tentativasUsadas: number;
  tentativasLimitadas: boolean;
  tentativasMaximas: number | null;
  ultimaNota: number | null;
} | null;

async function getQuizResumo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aulaId: string,
  matriculaId: string | null,
): Promise<QuizResumo> {
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, titulo, tentativas_limitadas, tentativas_maximas")
    .eq("aula_id", aulaId)
    .maybeSingle();

  if (!quiz) return null;

  let tentativasUsadas = 0;
  let ultimaNota: number | null = null;

  if (matriculaId) {
    const { data: tentativas } = await supabase
      .from("tentativas_quiz")
      .select("nota")
      .eq("quiz_id", quiz.id)
      .eq("matricula_id", matriculaId)
      .order("numero", { ascending: false });
    tentativasUsadas = tentativas?.length ?? 0;
    ultimaNota = tentativas?.[0]?.nota ?? null;
  }

  return {
    id: quiz.id,
    titulo: quiz.titulo,
    tentativasUsadas,
    tentativasLimitadas: quiz.tentativas_limitadas,
    tentativasMaximas: quiz.tentativas_maximas,
    ultimaNota,
  };
}

// Sem tabela de progresso ainda — a "próxima aula" é puramente sequencial
// (numero da aula dentro do módulo, depois numero do módulo dentro do
// curso), recalculada a cada carregamento da página.
async function getNextAula(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoId: string,
  moduloAtual: { id: string; numero: number },
  aulaAtualId: string,
): Promise<NextAula> {
  const { data: aulasDoModulo } = await supabase
    .from("aulas")
    .select("id, numero")
    .eq("modulo_id", moduloAtual.id)
    .order("numero");

  const aulas = (aulasDoModulo ?? []) as { id: string; numero: number }[];
  const idx = aulas.findIndex((a) => a.id === aulaAtualId);
  if (idx !== -1 && idx < aulas.length - 1) {
    return { moduloId: moduloAtual.id, aulaId: aulas[idx + 1].id };
  }

  const { data: proximoModulo } = await supabase
    .from("modulos")
    .select("id")
    .eq("curso_id", cursoId)
    .eq("numero", moduloAtual.numero + 1)
    .maybeSingle();

  if (!proximoModulo) return null;

  const { data: primeiraAula } = await supabase
    .from("aulas")
    .select("id")
    .eq("modulo_id", proximoModulo.id)
    .order("numero")
    .limit(1)
    .maybeSingle();

  if (!primeiraAula) return null;

  return { moduloId: proximoModulo.id, aulaId: primeiraAula.id };
}

export default async function AulaConteudoPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string }>;
}) {
  const user = await requireRole("aluno");
  const { id: cursoId, moduloId, aulaId } = await params;

  const supabase = await createClient();

  const temAcesso = await alunoTemAcessoAoCurso(supabase, user.id, cursoId);
  if (!temAcesso) {
    notFound();
  }

  const { data: aulaData } = await supabase
    .from("aulas")
    .select("id, numero, titulo, modulo_id, modulos(id, numero, titulo, curso_id)")
    .eq("id", aulaId)
    .eq("modulo_id", moduloId)
    .single();

  const aula = aulaData as unknown as AulaRow | null;

  if (!aula || !aula.modulos || aula.modulos.curso_id !== cursoId) {
    notFound();
  }

  const modulo = aula.modulos;
  const matriculaId = await getMatriculaIdAtivaParaCurso(supabase, user.id, cursoId);

  const [
    { data: materiaisData, error: materiaisError },
    nextAula,
    { pdfs, error: pdfsError },
    { data: concluidaData },
    quizResumo,
  ] = await Promise.all([
    supabase
      .from("materiais")
      .select("id, url")
      .eq("aula_id", aulaId)
      .eq("tipo", "video_youtube")
      .order("ordem")
      .limit(1),
    getNextAula(supabase, cursoId, modulo, aulaId),
    getPdfMateriais(supabase, aulaId),
    supabase.from("aulas_concluidas").select("id").eq("aula_id", aulaId).limit(1).maybeSingle(),
    getQuizResumo(supabase, aulaId, matriculaId),
  ]);

  const videoMaterial = materiaisData?.[0] ?? null;
  const videoId = videoMaterial ? extractYoutubeVideoId(videoMaterial.url) : null;
  const concluidaInicial = !!concluidaData;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/aluno/cursos/${cursoId}/modulos/${moduloId}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Módulo {modulo.numero} — {modulo.titulo}
        </Button>
        <h1 className="text-2xl font-semibold">
          Aula {aula.numero} — {aula.titulo}
        </h1>
      </div>

      {materiaisError ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar o vídeo desta aula. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : videoId ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3`}
            title={`Vídeo da aula: ${aula.titulo}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum vídeo disponível para esta aula ainda.
            </p>
          </CardContent>
        </Card>
      )}

      {pdfsError ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os materiais desta aula. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : (
        pdfs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pdfs.map((pdf) => (
              <PdfViewerButton key={pdf.id} materialId={pdf.id} titulo={pdf.titulo} />
            ))}
          </div>
        )
      )}

      {quizResumo && (
        <Link href={`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz`}>
          <Card className="hover:bg-accent/50 transition-colors">
            <CardContent className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{quizResumo.titulo}</p>
                <p className="text-muted-foreground text-sm">
                  {quizResumo.tentativasUsadas === 0
                    ? "Quiz disponível"
                    : `Última nota: ${quizResumo.ultimaNota}%`}
                </p>
              </div>
              {quizResumo.tentativasLimitadas && (
                <Badge variant="secondary">
                  {quizResumo.tentativasUsadas}/{quizResumo.tentativasMaximas}
                </Badge>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="flex justify-end">
        <ToggleAulaConcluidaButton
          cursoId={cursoId}
          aulaId={aulaId}
          concluidaInicial={concluidaInicial}
        />
      </div>

      {nextAula && (
        <div className="flex justify-end">
          <Button
            render={
              <Link
                href={`/aluno/cursos/${cursoId}/modulos/${nextAula.moduloId}/aulas/${nextAula.aulaId}`}
              />
            }
            nativeButton={false}
          >
            Próxima aula
            <ArrowRight />
          </Button>
        </div>
      )}
    </div>
  );
}
