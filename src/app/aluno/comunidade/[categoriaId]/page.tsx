import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { exigirComunidadeAtiva } from "@/lib/comunidade/config";
import { COLUNAS_CATEGORIA, listarPostsDaCategoria, paraCategoriaView } from "@/lib/comunidade/dados";
import { ComunidadePostCard } from "@/components/aluno/comunidade-post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Paginacao } from "@/components/ui/paginacao";
import { z } from "zod";

export default async function ComunidadeCategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaId: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const user = await requireRole("aluno");
  const { categoriaId } = await params;
  const sp = await searchParams;

  if (!z.uuid().safeParse(categoriaId).success) notFound();

  const supabase = await createClient();
  await exigirComunidadeAtiva(supabase);

  const { data: linha } = await supabase
    .from("comunidade_categorias")
    .select(COLUNAS_CATEGORIA)
    .eq("id", categoriaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!linha) notFound();
  const categoria = paraCategoriaView(linha as Parameters<typeof paraCategoriaView>[0], 0);

  const limite = parseLimite(sp.limit);
  const pagina = parsePagina(sp.page);
  const { posts, total, erro } = await listarPostsDaCategoria(supabase, categoriaId, user.id, calcularOffset(pagina, limite), limite);

  const baseUrl = `/aluno/comunidade/${categoriaId}`;
  const paramsPaginacao: Record<string, string> = {};
  if (sp.limit) paramsPaginacao.limit = String(limite);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <Button render={<Link href="/aluno/comunidade" />} nativeButton={false} variant="ghost" size="sm" className="mb-2 -ml-2">
          <ArrowLeft />
          Comunidade
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${categoria.cor}26` }}
              aria-hidden
            >
              {categoria.icone}
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{categoria.nome}</h1>
              {categoria.descricao && <p className="text-muted-foreground text-sm">{categoria.descricao}</p>}
            </div>
          </div>
          {categoria.somenteAdmin ? (
            <p className="text-muted-foreground text-sm">Somente a equipe publica nesta categoria.</p>
          ) : (
            <Button render={<Link href={`/aluno/comunidade/nova?categoria=${categoriaId}`} />} nativeButton={false}>
              <Plus />
              Novo post
            </Button>
          )}
        </div>
      </div>

      {erro ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os posts. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum post nesta categoria ainda.</p>
            {!categoria.somenteAdmin && (
              <Button render={<Link href={`/aluno/comunidade/nova?categoria=${categoriaId}`} />} nativeButton={false}>
                <Plus />
                Publicar o primeiro post
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <ComunidadePostCard key={post.id} post={post} />
            ))}
          </div>
          <Paginacao
            paginaAtual={pagina}
            totalPaginas={calcularTotalPaginas(total, limite)}
            totalRegistros={total}
            limite={limite}
            baseUrl={baseUrl}
            searchParams={paramsPaginacao}
          />
        </>
      )}
    </div>
  );
}
