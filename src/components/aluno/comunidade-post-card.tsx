import Link from "next/link";
import { Heart, MessageCircle, Pin } from "lucide-react";
import { formatarDataHora, type PostResumoView } from "@/lib/comunidade/tipos";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Linha de post nas listagens (principal e categoria). Sem estado: o card inteiro é um link.
export function ComunidadePostCard({ post, mostrarCategoria = false }: { post: PostResumoView; mostrarCategoria?: boolean }) {
  return (
    <Link href={`/aluno/comunidade/post/${post.id}`} className="block rounded-xl transition-colors hover:bg-accent/30">
      <Card className={post.fixado ? "border-primary/40" : undefined}>
        <CardContent className="flex items-start gap-3 py-4">
          <Avatar>
            <AvatarFallback>{post.autor.iniciais}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {post.fixado && (
                <Badge variant="default">
                  <Pin />
                  Fixado
                </Badge>
              )}
              {mostrarCategoria && (
                <Badge variant="outline" style={{ borderColor: post.categoriaCor, color: post.categoriaCor }}>
                  {post.categoriaIcone} {post.categoriaNome}
                </Badge>
              )}
              <h3 className="min-w-0 font-medium break-words">{post.titulo}</h3>
            </div>
            <p className="text-muted-foreground text-sm break-words">{post.preview}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>
                {post.autor.nome}
                {post.autor.equipe && <Badge variant="secondary" className="ml-1.5">Equipe</Badge>}
              </span>
              <span>{formatarDataHora(post.createdAt)}</span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {post.totalRespostas}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="size-3.5" />
                {post.totalCurtidas}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
