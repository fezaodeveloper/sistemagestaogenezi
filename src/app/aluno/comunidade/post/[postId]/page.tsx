import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, Pin } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { exigirComunidadeAtiva } from "@/lib/comunidade/config";
import { getPostCompleto, listarRespostas } from "@/lib/comunidade/dados";
import { formatarDataHora, LIMITE_CONTEUDO_RESPOSTA } from "@/lib/comunidade/tipos";
import { ComunidadeCurtirButton } from "@/components/aluno/comunidade-curtir-button";
import { ComunidadeExcluirButton } from "@/components/aluno/comunidade-excluir-button";
import { ComunidadeRespostaForm } from "@/components/aluno/comunidade-resposta-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ComunidadePostPage({ params }: { params: Promise<{ postId: string }> }) {
  const user = await requireRole("aluno");
  const { postId } = await params;

  if (!z.uuid().safeParse(postId).success) notFound();

  const supabase = await createClient();
  const config = await exigirComunidadeAtiva(supabase);

  const post = await getPostCompleto(supabase, postId, user.id);
  if (!post) notFound();

  const { respostas, erro: erroRespostas } = await listarRespostas(supabase, postId, user.id);
  const voltarPara = `/aluno/comunidade/${post.categoriaId}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Button render={<Link href={voltarPara} />} nativeButton={false} variant="ghost" size="sm" className="-ml-2">
          <ArrowLeft />
          {post.categoriaIcone} {post.categoriaNome}
        </Button>
      </div>

      <Card className={post.fixado ? "border-primary/40" : undefined}>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {post.fixado && (
              <Badge>
                <Pin />
                Fixado
              </Badge>
            )}
            <h1 className="min-w-0 text-xl font-semibold break-words">{post.titulo}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{post.autor.iniciais}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {post.autor.nome}
                {post.autor.equipe && <Badge variant="secondary" className="ml-1.5">Equipe</Badge>}
              </span>
              <span className="text-muted-foreground text-xs">{formatarDataHora(post.createdAt)}</span>
            </div>
          </div>

          <p className="text-sm break-words whitespace-pre-wrap">{post.conteudo}</p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <ComunidadeCurtirButton alvo="post" id={post.id} curtidoInicial={post.curtido} totalInicial={post.totalCurtidas} />
            {post.proprio && config.alunosExcluem && (
              <ComunidadeExcluirButton tipo="post" id={post.id} aposExcluir={voltarPara} />
            )}
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          Respostas
          {respostas.length > 0 && <span className="text-muted-foreground ml-2 text-sm font-normal">({respostas.length})</span>}
        </h2>

        <ComunidadeRespostaForm postId={post.id} />
        <p className="text-muted-foreground -mt-2 text-xs">Até {LIMITE_CONTEUDO_RESPOSTA} caracteres.</p>

        {erroRespostas ? (
          <Card>
            <CardContent className="text-destructive py-6 text-center text-sm">
              Não foi possível carregar as respostas. Tente recarregar a página.
            </CardContent>
          </Card>
        ) : respostas.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-6 text-center text-sm">
              Nenhuma resposta ainda. Seja o primeiro a responder!
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {respostas.map((resposta) => (
              <li key={resposta.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarFallback>{resposta.autor.iniciais}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium">{resposta.autor.nome}</span>
                          {resposta.autor.equipe && <Badge variant="secondary">Equipe</Badge>}
                          <span className="text-muted-foreground text-xs">{formatarDataHora(resposta.createdAt)}</span>
                        </div>
                        <p className="text-sm break-words whitespace-pre-wrap">{resposta.conteudo}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pl-11">
                      <ComunidadeCurtirButton
                        alvo="resposta"
                        id={resposta.id}
                        curtidoInicial={resposta.curtido}
                        totalInicial={resposta.totalCurtidas}
                      />
                      {resposta.proprio && config.alunosExcluem && <ComunidadeExcluirButton tipo="resposta" id={resposta.id} />}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
