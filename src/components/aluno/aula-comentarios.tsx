"use client";

// "use client": estado do formulário (textarea + contador), Server Actions e diálogo de exclusão.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2 } from "lucide-react";
import { criarComentario, excluirComentario } from "@/app/aluno/comentarios/actions";
import { COMENTARIO_LIMITE_TEXTO, type ComentarioAulaView } from "@/lib/comentarios/tipos";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function AulaComentarios({
  cursoId,
  moduloId,
  aulaId,
  moderacao,
  comentarios,
  erroAoCarregar,
}: {
  cursoId: string;
  moduloId: string;
  aulaId: string;
  moderacao: boolean;
  comentarios: ComentarioAulaView[];
  erroAoCarregar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();

  const [paraExcluir, setParaExcluir] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [excluindo, startExclusao] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setAviso(null);
    startEnvio(async () => {
      const r = await criarComentario(cursoId, moduloId, aulaId, texto);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setTexto("");
      setAviso(r.aprovado ? "Comentário publicado." : "Comentário enviado! Ele aparecerá para os colegas depois de revisado.");
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!paraExcluir) return;
    setErroExclusao(null);
    startExclusao(async () => {
      const r = await excluirComentario(cursoId, moduloId, aulaId, paraExcluir);
      if ("error" in r) {
        setErroExclusao(r.error);
        return;
      }
      setParaExcluir(null);
      router.refresh();
    });
  }

  const restantes = COMENTARIO_LIMITE_TEXTO - texto.length;

  return (
    <section id="comentarios" className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="size-5" />
        Comentários
        {comentarios.length > 0 && <span className="text-muted-foreground text-sm font-normal">({comentarios.length})</span>}
      </h2>

      <form onSubmit={enviar} className="flex flex-col gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={COMENTARIO_LIMITE_TEXTO}
          rows={3}
          placeholder="Escreva sua dúvida ou comentário sobre esta aula..."
          aria-label="Novo comentário"
          disabled={enviando}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs ${restantes <= 100 ? "text-amber-600" : "text-muted-foreground"}`}>
            {texto.length}/{COMENTARIO_LIMITE_TEXTO}
          </span>
          <Button type="submit" disabled={enviando || texto.trim().length === 0}>
            {enviando ? "Enviando..." : "Comentar"}
          </Button>
        </div>
        {moderacao && <p className="text-muted-foreground text-xs">Seu comentário será revisado antes de aparecer.</p>}
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            {aviso}
          </p>
        )}
      </form>

      {erroAoCarregar ? (
        <Card>
          <CardContent className="text-destructive py-6 text-center text-sm">
            Não foi possível carregar os comentários. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : comentarios.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {comentarios.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>{c.iniciais}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium">{c.autorNome}</span>
                        <span className="text-muted-foreground text-xs">{formatarDataHora(c.createdAt)}</span>
                        {c.proprio && c.status === "pendente" && <Badge variant="secondary">Aguardando aprovação</Badge>}
                        {c.proprio && c.status === "rejeitado" && <Badge variant="destructive">Não aprovado</Badge>}
                      </div>
                      <p className="text-sm break-words whitespace-pre-wrap">{c.texto}</p>
                    </div>
                    {c.proprio && c.status === "aprovado" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setErroExclusao(null);
                          setParaExcluir(c.id);
                        }}
                      >
                        <Trash2 />
                        Excluir
                      </Button>
                    )}
                  </div>

                  {c.respostaAdmin && (
                    <div className="border-primary bg-primary/5 ml-11 rounded-md border-l-4 p-3">
                      <p className="text-primary text-xs font-semibold">
                        Resposta da equipe
                        {c.respondidoAt && (
                          <span className="text-muted-foreground ml-2 font-normal">{formatarDataHora(c.respondidoAt)}</span>
                        )}
                      </p>
                      <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.respostaAdmin}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={paraExcluir !== null} onOpenChange={(aberto) => !aberto && !excluindo && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? O comentário (e a resposta da equipe, se houver) será removido.</AlertDialogDescription>
          </AlertDialogHeader>
          {erroExclusao && (
            <p role="alert" className="text-destructive text-sm">
              {erroExclusao}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={excluindo} onClick={confirmarExclusao}>
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
