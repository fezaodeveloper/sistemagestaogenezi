import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { alunoTemAcessoAoCurso, getMatriculaAtivaComTurma } from "@/lib/matriculas/access";
import { getLiberacaoAulasCurso, type AulaLiberacao } from "@/lib/cronograma/liberacao";
import { extractYoutubeVideoId } from "@/lib/materiais/youtube";
import { AulaAcoesBar } from "@/components/aluno/aula-acoes-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

type AulaRow = {
  id: string;
  numero: number;
  titulo: string;
  modulo_id: string;
  modulos: { id: string; numero: number; titulo: string; curso_id: string } | null;
};

type NextAula = { moduloId: string; aulaId: string } | null;

type PdfMaterialView = { id: string; titulo: string };

type Resumo = { tentativasUsadas: number; ultimaNota: number | null } | null;

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

async function getQuizResumo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aulaId: string,
  matriculaId: string | null,
): Promise<Resumo> {
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("aula_id", aulaId)
    .maybeSingle();

  if (!quiz) return null;
  if (!matriculaId) return { tentativasUsadas: 0, ultimaNota: null };

  const { data: tentativas } = await supabase
    .from("tentativas_quiz")
    .select("nota")
    .eq("quiz_id", quiz.id)
    .eq("matricula_id", matriculaId)
    .order("numero", { ascending: false });

  return {
    tentativasUsadas: tentativas?.length ?? 0,
    ultimaNota: tentativas?.[0]?.nota ?? null,
  };
}

// Sempre buscada — a prova é do módulo inteiro, e o pill só é exibido
// (ver isModuloCompleto mais abaixo) quando todas as aulas do módulo
// estiverem concluídas, independente de em qual aula o aluno está.
async function getProvaResumo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduloId: string,
  matriculaId: string | null,
): Promise<Resumo> {
  const { data: prova } = await supabase
    .from("provas")
    .select("id")
    .eq("modulo_id", moduloId)
    .maybeSingle();

  if (!prova) return null;
  if (!matriculaId) return { tentativasUsadas: 0, ultimaNota: null };

  const { data: tentativas } = await supabase
    .from("tentativas_prova")
    .select("nota")
    .eq("prova_id", prova.id)
    .eq("matricula_id", matriculaId)
    .order("numero", { ascending: false });

  return {
    tentativasUsadas: tentativas?.length ?? 0,
    ultimaNota: tentativas?.[0]?.nota ?? null,
  };
}

// Sem tabela de progresso ainda — a "próxima aula" é puramente sequencial
// (numero da aula dentro do módulo, depois numero do módulo dentro do
// curso), recalculada a cada carregamento da página. Recebe a lista de
// aulas do módulo já buscada pela página (evita query duplicada — a mesma
// lista também é usada pra calcular isModuloCompleto).
async function getNextAula(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cursoId: string,
  moduloAtual: { id: string; numero: number },
  aulaAtualId: string,
  aulasDoModuloAtual: { id: string; numero: number }[],
): Promise<NextAula> {
  const idx = aulasDoModuloAtual.findIndex((a) => a.id === aulaAtualId);
  if (idx !== -1 && idx < aulasDoModuloAtual.length - 1) {
    return { moduloId: moduloAtual.id, aulaId: aulasDoModuloAtual[idx + 1].id };
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

// Ids das aulas do módulo que já têm conclusão registrada pra essa
// matrícula — usado pra decidir se o módulo está 100% concluído (ver
// isModuloCompleto), o gate de exibição do pill da prova.
async function getAulasConcluidasIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aulaIds: string[],
  matriculaId: string | null,
): Promise<Set<string>> {
  if (!matriculaId || aulaIds.length === 0) return new Set();

  const { data } = await supabase
    .from("aulas_concluidas")
    .select("aula_id")
    .in("aula_id", aulaIds)
    .eq("matricula_id", matriculaId);

  return new Set((data ?? []).map((row) => row.aula_id as string));
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
  const matricula = await getMatriculaAtivaComTurma(supabase, user.id, cursoId);

  const liberacaoMap = matricula
    ? await getLiberacaoAulasCurso(supabase, cursoId, matricula.turmaId)
    : new Map<string, AulaLiberacao>();
  const liberacaoAula = liberacaoMap.get(aulaId) ?? {
    liberada: true,
    motivoBloqueio: null,
    dataLiberacao: null,
  };

  if (!liberacaoAula.liberada) {
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
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Lock className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">
              {liberacaoAula.motivoBloqueio === "sequencial"
                ? "Conclua a aula anterior para desbloquear esta aula."
                : `Esta aula estará disponível em ${formatDateBR(liberacaoAula.dataLiberacao!)}.`}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matriculaId = matricula?.id ?? null;

  const { data: aulasDoModuloData } = await supabase
    .from("aulas")
    .select("id, numero")
    .eq("modulo_id", moduloId)
    .order("numero");
  const aulasDoModulo = (aulasDoModuloData ?? []) as { id: string; numero: number }[];

  const [
    { data: materiaisData, error: materiaisError },
    nextAula,
    { pdfs, error: pdfsError },
    { data: concluidaData },
    quizResumo,
    provaResumo,
    aulasConcluidasIds,
  ] = await Promise.all([
    supabase
      .from("materiais")
      .select("id, url")
      .eq("aula_id", aulaId)
      .eq("tipo", "video_youtube")
      .order("ordem")
      .limit(1),
    getNextAula(supabase, cursoId, modulo, aulaId, aulasDoModulo),
    getPdfMateriais(supabase, aulaId),
    supabase.from("aulas_concluidas").select("id").eq("aula_id", aulaId).limit(1).maybeSingle(),
    getQuizResumo(supabase, aulaId, matriculaId),
    getProvaResumo(supabase, moduloId, matriculaId),
    getAulasConcluidasIds(
      supabase,
      aulasDoModulo.map((a) => a.id),
      matriculaId,
    ),
  ]);

  const videoMaterial = materiaisData?.[0] ?? null;
  const videoId = videoMaterial ? extractYoutubeVideoId(videoMaterial.url) : null;
  const concluidaInicial = !!concluidaData;
  const isModuloCompleto =
    aulasDoModulo.length > 0 && aulasDoModulo.every((a) => aulasConcluidasIds.has(a.id));

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

      <AulaAcoesBar
        cursoId={cursoId}
        moduloId={moduloId}
        aulaId={aulaId}
        pdfs={pdfs}
        pdfsError={pdfsError}
        quizResumo={quizResumo}
        quizHref={`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz`}
        provaResumo={isModuloCompleto ? provaResumo : null}
        provaHref={`/aluno/cursos/${cursoId}/modulos/${moduloId}/prova`}
        concluidaInicial={concluidaInicial}
      />

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
