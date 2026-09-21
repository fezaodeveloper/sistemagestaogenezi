"use client";

// "use client": expansão do post, carga sob demanda das respostas, Server Actions de moderação
// e diálogo de confirmação.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Eye, EyeOff, Heart, MessageCircle, Pin, PinOff, Trash2, Undo2 } from "lucide-react";
import {
  fixarPost,
  listarRespostasAdmin,
  moderarPost,
  moderarResposta,
  type RespostaAdminView,
} from "@/app/admin/configuracoes/portal-aluno/comunidade/actions";
import { COMUNIDADE_STATUS_LABEL, formatarDataHora, type ComunidadeStatus } from "@/lib/comunidade/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export type PostAdminView = {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  autorNome: string;
  autorEquipe: boolean;
  status: ComunidadeStatus;
  fixado: boolean;
  totalRespostas: number;
  totalCurtidas: number;
  createdAt: string;
};

const VARIANTE_STATUS: Record<ComunidadeStatus, "default" | "secondary" | "destructive"> = {
  ativo: "default",
  oculto: "secondary",
  removido: "destructive",
};

export function ComunidadePostAdminCard({ post }: { post: PostAdminView }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const [expandido, setExpandido] = useState(false);
  const [respostas, setRespostas] = useState<RespostaAdminView[] | null>(null);
  const [erroRespostas, setErroRespostas] = useState<string | null>(null);
  const [carregando, startCarregar] = useTransition();
  const [respostaConfirmando, setRespostaConfirmando] = useState<string | null>(null);

  function executar(acao: () => Promise<{ success: true } | { error: string }>, aoConcluir?: () => void) {
    setErro(null);
    startTransition(async () => {
      const r = await acao();
      if ("error" in r) {
        setErro(r.error);
        setConfirmando(false);
        return;
      }
      aoConcluir?.();
      setConfirmando(false);
      router.refresh();
    });
  }

  function carregarRespostas() {
    setErroRespostas(null);
    startCarregar(async () => {
      const r = await listarRespostasAdmin(post.id);
      if ("error" in r) {
        setErroRespostas(r.error);
        return;
      }
      setRespostas(r.respostas);
    });
  }

  function alternarExpandido() {
    const proximo = !expandido;
    setExpandido(proximo);
    if (proximo && respostas === null) carregarRespostas();
  }

  function moderarRespostaAdmin(id: string, status: ComunidadeStatus) {
    setErroRespostas(null);
    startTransition(async () => {
      const r = await moderarResposta(id, status);
      if ("error" in r) {
        setErroRespostas(r.error);
        return;
      }
      setRespostaConfirmando(null);
      setRespostas((atual) => atual?.map((x) => (x.id === id ? { ...x, status } : x)) ?? atual);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-medium break-words">
              {post.fixado && <Pin className="text-primary size-4 shrink-0" aria-label="Fixado" />}
              {post.titulo}
            </span>
            <span className="text-muted-foreground text-xs">
              {post.autorNome}
              {post.autorEquipe && " (equipe)"} · {post.categoria} · {formatarDataHora(post.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {post.totalRespostas}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="size-3.5" />
                {post.totalCurtidas}
              </span>
            </span>
            <Badge variant={VARIANTE_STATUS[post.status]}>{COMUNIDADE_STATUS_LABEL[post.status]}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => fixarPost(post.id, !post.fixado))}>
            {post.fixado ? <PinOff /> : <Pin />}
            {post.fixado ? "Desafixar" : "Fixar no topo"}
          </Button>
          {post.status === "ativo" ? (
            <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => moderarPost(post.id, "oculto"))}>
              <EyeOff />
              Ocultar
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => moderarPost(post.id, "ativo"))}>
              {post.status === "oculto" ? <Eye /> : <Undo2 />}
              {post.status === "oculto" ? "Mostrar" : "Restaurar"}
            </Button>
          )}
          {post.status !== "removido" && (
            <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={() => setConfirmando(true)}>
              <Trash2 />
              Remover
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={alternarExpandido} aria-expanded={expandido}>
            {expandido ? <ChevronUp /> : <ChevronDown />}
            {expandido ? "Recolher" : "Ver conteúdo e respostas"}
          </Button>
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}

        {expandido && (
          <div className="flex flex-col gap-3 border-t pt-3">
            <p className="text-sm break-words whitespace-pre-wrap">{post.conteudo}</p>

            <h4 className="text-sm font-medium">Respostas</h4>
            {erroRespostas && (
              <p role="alert" className="text-destructive text-sm">
                {erroRespostas}
              </p>
            )}
            {carregando || respostas === null ? (
              !erroRespostas && <p className="text-muted-foreground text-sm">Carregando respostas...</p>
            ) : respostas.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma resposta.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {respostas.map((r) => (
                  <li key={r.id} className="bg-muted/40 flex flex-col gap-2 rounded-md p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">
                        {r.autorNome} · {formatarDataHora(r.createdAt)}
                      </span>
                      <Badge variant={VARIANTE_STATUS[r.status]}>{COMUNIDADE_STATUS_LABEL[r.status]}</Badge>
                    </div>
                    <p className="text-sm break-words whitespace-pre-wrap">{r.conteudo}</p>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "ativo" ? (
                        <Button type="button" size="xs" variant="outline" disabled={pendente} onClick={() => moderarRespostaAdmin(r.id, "oculto")}>
                          <EyeOff />
                          Ocultar
                        </Button>
                      ) : (
                        <Button type="button" size="xs" variant="outline" disabled={pendente} onClick={() => moderarRespostaAdmin(r.id, "ativo")}>
                          <Undo2 />
                          {r.status === "oculto" ? "Mostrar" : "Restaurar"}
                        </Button>
                      )}
                      {r.status !== "removido" && (
                        <Button type="button" size="xs" variant="ghost" disabled={pendente} onClick={() => setRespostaConfirmando(r.id)}>
                          <Trash2 />
                          Remover
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmando} onOpenChange={(aberto) => !pendente && setConfirmando(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover post</AlertDialogTitle>
            <AlertDialogDescription>
              Remover <strong>{post.titulo}</strong>? Ele deixa de aparecer para os alunos. Você pode restaurá-lo depois neste painel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pendente} onClick={() => executar(() => moderarPost(post.id, "removido"))}>
              {pendente ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={respostaConfirmando !== null} onOpenChange={(aberto) => !pendente && !aberto && setRespostaConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover resposta</AlertDialogTitle>
            <AlertDialogDescription>A resposta deixa de aparecer para os alunos. Você pode restaurá-la depois.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendente}
              onClick={() => respostaConfirmando && moderarRespostaAdmin(respostaConfirmando, "removido")}
            >
              {pendente ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
