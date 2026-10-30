"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, MessageCircle, User, XCircle } from "lucide-react";
import {
  getUrlCurriculoCandidato,
  marcarCandidaturaContatada,
  marcarCandidaturaContratada,
  marcarCandidaturaVisualizada,
  rejeitarCandidatura,
  rejeitarTodosPendentesDaVaga,
} from "@/app/empresa/(protegido)/candidatos/actions";
import {
  CANDIDATURA_STATUS_BADGE_CLASS,
  CANDIDATURA_STATUS_LABELS,
  type CandidaturaEmpresa,
} from "@/lib/conecta/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const STATUS_FINAIS = new Set<CandidaturaEmpresa["status"]>(["rejeitado", "contratado"]);

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function VerCurriculoButton({ path }: { path: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await getUrlCurriculoCandidato(path);
      if (resultado.error || !resultado.url) {
        setError(resultado.error ?? "Não foi possível abrir o currículo.");
        return;
      }
      window.open(resultado.url, "_blank", "noreferrer");
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        <FileText className="size-4" />
        {isPending ? "Gerando link..." : "Ver currículo"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function CandidaturaDetalhesDialog({ candidatura }: { candidatura: CandidaturaEmpresa }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const whatsappDigitos = candidatura.candidatoWhatsapp?.replace(/\D/g, "");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    // Marca como visualizado ao ABRIR (TAREFA: WhatsApp só aparece depois de visualizar) — a
    // própria action já faz o `router.refresh()` necessário pra o badge de status atualizar.
    if (nextOpen && candidatura.status === "pendente") {
      startTransition(async () => {
        await marcarCandidaturaVisualizada(candidatura.id);
        router.refresh();
      });
    }
  }

  function handleContato() {
    startTransition(async () => {
      await marcarCandidaturaContatada(candidatura.id);
      router.refresh();
    });
  }

  function handleContratado() {
    startTransition(async () => {
      await marcarCandidaturaContratada(candidatura.id);
      setOpen(false);
      router.refresh();
    });
  }

  function handleRejeitar() {
    startTransition(async () => {
      await rejeitarCandidatura(candidatura.id);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" className="w-full" />}>
        Ver detalhes
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
              <User className="text-muted-foreground size-4" />
            </div>
            <div>
              <DialogTitle>{candidatura.candidatoNome}</DialogTitle>
              <p className="text-muted-foreground text-sm">Vaga: {candidatura.vagaTitulo}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {candidatura.candidatoResumo && (
            <p className="text-muted-foreground">{candidatura.candidatoResumo}</p>
          )}
          {candidatura.candidatoCursosConcluidos.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">Cursos concluídos na Gênezi:</span>
              <div className="flex flex-wrap gap-1">
                {candidatura.candidatoCursosConcluidos.map((nome) => (
                  <Badge key={nome} variant="secondary" className="text-xs">
                    {nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-3">
            {whatsappDigitos && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                nativeButton={false}
                render={
                  <a
                    href={`https://wa.me/55${whatsappDigitos}?text=${encodeURIComponent(
                      `Olá! Vi sua candidatura para a vaga "${candidatura.vagaTitulo}" no Gênezi Conecta.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <MessageCircle className="size-4" />
                Entrar em contato via WhatsApp
              </Button>
            )}
            {candidatura.candidatoCurriculoPath && <VerCurriculoButton path={candidatura.candidatoCurriculoPath} />}
          </div>
        </div>

        <DialogFooter>
          {!STATUS_FINAIS.has(candidatura.status) && (
            <>
              <Button type="button" variant="outline" disabled={isPending} onClick={handleRejeitar}>
                <XCircle className="size-4" />
                Rejeitar
              </Button>
              {candidatura.status !== "contato" && (
                <Button type="button" variant="outline" disabled={isPending} onClick={handleContato}>
                  Marcar como contatado
                </Button>
              )}
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                disabled={isPending}
                onClick={handleContratado}
              >
                <CheckCircle2 className="size-4" />
                Marcar como contratado
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidaturaCard({ candidatura }: { candidatura: CandidaturaEmpresa }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <User className="text-muted-foreground size-4" />
            <span className="font-medium">{candidatura.candidatoNome}</span>
          </div>
          <Badge className={CANDIDATURA_STATUS_BADGE_CLASS[candidatura.status]}>
            {CANDIDATURA_STATUS_LABELS[candidatura.status]}
          </Badge>
        </div>
        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <span>Vaga: {candidatura.vagaTitulo}</span>
          <span>Candidatou-se em {formatDateBR(candidatura.createdAt)}</span>
        </div>
        <CandidaturaDetalhesDialog candidatura={candidatura} />
      </CardContent>
    </Card>
  );
}

function RejeitarTodosPendentesButton({ vagaId, temPendentes }: { vagaId: string; temPendentes: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!temPendentes) return null;

  function handleRejeitarTodos() {
    startTransition(async () => {
      const resultado = await rejeitarTodosPendentesDaVaga(vagaId);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <XCircle className="size-4" />
        Rejeitar todos os pendentes
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rejeitar todos os pendentes desta vaga</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as candidaturas ainda pendentes nesta vaga serão marcadas como rejeitadas. Candidaturas já
            visualizadas, contatadas ou contratadas não são afetadas. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleRejeitarTodos}>
            {isPending ? "Rejeitando..." : "Rejeitar todos"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CandidaturasView({ candidaturas }: { candidaturas: CandidaturaEmpresa[] }) {
  if (candidaturas.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma candidatura recebida ainda.
        </CardContent>
      </Card>
    );
  }

  // Agrupado por vaga (TAREFA: "Rejeitar todos os pendentes DESTA VAGA" é uma ação por vaga, não
  // global) — mantém a ordem em que cada vaga apareceu primeiro na lista (já ordenada por
  // created_at desc em getCandidaturasEmpresa).
  const porVaga = new Map<string, { titulo: string; itens: CandidaturaEmpresa[] }>();
  for (const candidatura of candidaturas) {
    const grupo = porVaga.get(candidatura.vagaId) ?? { titulo: candidatura.vagaTitulo, itens: [] };
    grupo.itens.push(candidatura);
    porVaga.set(candidatura.vagaId, grupo);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...porVaga.entries()].map(([vagaId, grupo]) => (
        <div key={vagaId} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <h3 className="font-semibold">{grupo.titulo}</h3>
            <RejeitarTodosPendentesButton
              vagaId={vagaId}
              temPendentes={grupo.itens.some((c) => c.status === "pendente")}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.itens.map((candidatura) => (
              <CandidaturaCard key={candidatura.id} candidatura={candidatura} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
