"use client";

// "use client": estado da resposta, Server Actions de moderação e diálogo de exclusão.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import {
  excluirComentarioAdmin,
  moderarComentario,
  responderComentario,
} from "@/app/admin/configuracoes/portal-aluno/comentarios/actions";
import { COMENTARIO_LIMITE_TEXTO, COMENTARIO_STATUS_LABEL, type ComentarioStatus } from "@/lib/comentarios/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

export type ComentarioAdminView = {
  id: string;
  alunoNome: string;
  aulaTitulo: string;
  createdAt: string;
  texto: string;
  status: ComentarioStatus;
  respostaAdmin: string | null;
  respondidoAt: string | null;
};

const VARIANTE_STATUS: Record<ComentarioStatus, "secondary" | "default" | "destructive"> = {
  pendente: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
};

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

export function ComentarioAdminCard({ comentario }: { comentario: ComentarioAdminView }) {
  const router = useRouter();
  const [resposta, setResposta] = useState(comentario.respostaAdmin ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  const respostaAlterada = resposta.trim() !== (comentario.respostaAdmin ?? "");

  function moderar(status: "aprovado" | "rejeitado") {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await moderarComentario(comentario.id, status);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function salvarResposta() {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await responderComentario(comentario.id, resposta);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setAviso(
        !resposta.trim()
          ? "Resposta removida."
          : r.notificados > 0
            ? "Resposta salva e aluno notificado."
            : "Resposta salva. O aluno não tem dispositivo com notificações ativas.",
      );
      router.refresh();
    });
  }

  function excluir() {
    setErro(null);
    startTransition(async () => {
      const r = await excluirComentarioAdmin(comentario.id);
      if ("error" in r) {
        setErro(r.error);
        setConfirmando(false);
        return;
      }
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{comentario.alunoNome}</span>
            <span className="text-muted-foreground text-xs">
              {comentario.aulaTitulo} · {formatarDataHora(comentario.createdAt)}
            </span>
          </div>
          <Badge variant={VARIANTE_STATUS[comentario.status]}>{COMENTARIO_STATUS_LABEL[comentario.status]}</Badge>
        </div>

        <p className="text-sm break-words whitespace-pre-wrap">{comentario.texto}</p>

        {comentario.status === "pendente" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pendente} onClick={() => moderar("aprovado")}>
              <Check />
              Aprovar
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={() => moderar("rejeitado")}>
              <X />
              Rejeitar
            </Button>
          </div>
        )}
        {comentario.status === "rejeitado" && (
          <div>
            <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={() => moderar("aprovado")}>
              <Check />
              Aprovar mesmo assim
            </Button>
          </div>
        )}
        {comentario.status === "aprovado" && (
          <div>
            <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={() => moderar("rejeitado")}>
              <X />
              Rejeitar (ocultar)
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`resposta-${comentario.id}`}>Responder</Label>
          <Textarea
            id={`resposta-${comentario.id}`}
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            maxLength={COMENTARIO_LIMITE_TEXTO}
            rows={2}
            placeholder="Escreva a resposta da equipe..."
            disabled={pendente}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={pendente || !respostaAlterada} onClick={salvarResposta}>
              {pendente ? "Salvando..." : "Salvar"}
            </Button>
            {comentario.respondidoAt && !respostaAlterada && (
              <span className="text-muted-foreground text-xs">Respondido em {formatarDataHora(comentario.respondidoAt)}</span>
            )}
            {comentario.status !== "aprovado" && resposta.trim() && (
              <span className="text-muted-foreground text-xs">
                Os colegas só veem a resposta depois que o comentário for aprovado.
              </span>
            )}
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="text-sm text-green-600 dark:text-green-400">
            {aviso}
          </p>
        )}

        <div className="flex justify-end border-t pt-3">
          <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => setConfirmando(true)}>
            <Trash2 />
            Excluir
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmando} onOpenChange={(aberto) => !pendente && setConfirmando(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir definitivamente o comentário de <strong>{comentario.alunoNome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pendente} onClick={excluir}>
              {pendente ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
