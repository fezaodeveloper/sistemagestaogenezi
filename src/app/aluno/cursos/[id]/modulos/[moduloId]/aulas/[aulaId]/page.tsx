import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { alunoTemAcessoAoCurso } from "@/lib/matriculas/access";
import { extractYoutubeVideoId } from "@/lib/materiais/youtube";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AulaRow = {
  id: string;
  numero: number;
  titulo: string;
  modulo_id: string;
  modulos: { id: string; numero: number; titulo: string; curso_id: string } | null;
};

type NextAula = { moduloId: string; aulaId: string } | null;

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

  const [{ data: materiaisData, error: materiaisError }, nextAula] = await Promise.all([
    supabase
      .from("materiais")
      .select("id, url")
      .eq("aula_id", aulaId)
      .eq("tipo", "video_youtube")
      .order("ordem")
      .limit(1),
    getNextAula(supabase, cursoId, modulo, aulaId),
  ]);

  const videoMaterial = materiaisData?.[0] ?? null;
  const videoId = videoMaterial ? extractYoutubeVideoId(videoMaterial.url) : null;

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
