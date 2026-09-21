import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { exigirComunidadeAtiva } from "@/lib/comunidade/config";
import { listarCategoriasAluno, listarFeedRecente, listarPostsFixados } from "@/lib/comunidade/dados";
import { ComunidadePostCard } from "@/components/aluno/comunidade-post-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ComunidadePage() {
  const user = await requireRole("aluno");
  const supabase = await createClient();
  await exigirComunidadeAtiva(supabase);

  const [{ categorias, erro: erroCategorias }, fixados, feed] = await Promise.all([
    listarCategoriasAluno(supabase),
    listarPostsFixados(supabase, user.id),
    listarFeedRecente(supabase, user.id),
  ]);

  const podeCriar = categorias.some((c) => !c.somenteAdmin);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Comunidade</h1>
          <p className="text-muted-foreground text-sm">Converse, tire dúvidas e compartilhe conquistas com os colegas.</p>
        </div>
        {podeCriar && (
          <Button render={<Link href="/aluno/comunidade/nova" />} nativeButton={false}>
            <Plus />
            Novo post
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Categorias</h2>
        {erroCategorias ? (
          <Card>
            <CardContent className="text-destructive py-8 text-center text-sm">
              Não foi possível carregar as categorias. Tente recarregar a página.
            </CardContent>
          </Card>
        ) : categorias.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhuma categoria disponível ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categorias.map((categoria) => (
              <Link
                key={categoria.id}
                href={`/aluno/comunidade/${categoria.id}`}
                className="hover:bg-accent/30 block rounded-xl transition-colors"
              >
                <Card className="h-full" style={{ borderLeft: `4px solid ${categoria.cor}` }}>
                  <CardContent className="flex items-start gap-3 py-4">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-xl"
                      style={{ backgroundColor: `${categoria.cor}26` }}
                      aria-hidden
                    >
                      {categoria.icone}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{categoria.nome}</span>
                      {categoria.descricao && <span className="text-muted-foreground text-sm">{categoria.descricao}</span>}
                      <span className="text-muted-foreground mt-1 text-xs">
                        {categoria.totalPosts} {categoria.totalPosts === 1 ? "post" : "posts"}
                        {categoria.somenteAdmin && " · somente a equipe publica"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {fixados.posts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Em destaque</h2>
          <div className="flex flex-col gap-3">
            {fixados.posts.map((post) => (
              <ComunidadePostCard key={post.id} post={post} mostrarCategoria />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Atividade recente</h2>
        {feed.erro ? (
          <Card>
            <CardContent className="text-destructive py-8 text-center text-sm">
              Não foi possível carregar os posts recentes. Tente recarregar a página.
            </CardContent>
          </Card>
        ) : feed.posts.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhum post ainda. {podeCriar ? "Seja o primeiro a publicar!" : ""}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {feed.posts.map((post) => (
              <ComunidadePostCard key={post.id} post={post} mostrarCategoria />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
