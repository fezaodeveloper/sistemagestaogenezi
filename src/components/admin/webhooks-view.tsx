"use client";

// "use client": qual dialog está aberto, alternar ativo e confirmar exclusão.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { alternarAtivoWebhook, excluirWebhook } from "@/app/admin/configuracoes/apps/webhooks/actions";
import { WEBHOOK_EVENTO_LABELS, isWebhookEvento } from "@/lib/webhooks/eventos";
import { WebhookDialog, type CursoOpcao, type WebhookItem } from "@/components/admin/webhook-dialog";
import { WebhookLogsDialog } from "@/components/admin/webhook-logs-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

export function WebhooksView({ webhooks, cursos }: { webhooks: WebhookItem[]; cursos: CursoOpcao[] }) {
  const router = useRouter();
  // undefined = fechado; null = novo webhook; objeto = edição.
  const [editando, setEditando] = useState<WebhookItem | null | undefined>(undefined);
  const [verLogs, setVerLogs] = useState<WebhookItem | null>(null);
  const [excluindo, setExcluindo] = useState<WebhookItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternarAtivo(webhook: WebhookItem, ativo: boolean) {
    setErro(null);
    startTransition(async () => {
      const resultado = await alternarAtivoWebhook(webhook.id, ativo);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirWebhook(alvo.id);
      setExcluindo(null);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  const nomeCurso = new Map(cursos.map((curso) => [curso.id, curso.nome]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Webhooks configurados</h2>
        <Button type="button" onClick={() => setEditando(null)}>
          <Plus />
          Novo webhook
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum webhook configurado ainda.</p>
            <Button type="button" variant="outline" onClick={() => setEditando(null)}>
              <Plus />
              Criar o primeiro webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{webhook.nome}</p>
                      <Badge
                        className={
                          webhook.ativo
                            ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {webhook.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {webhook.temToken && <Badge variant="outline">Bearer Token</Badge>}
                    </div>
                    <code className="text-muted-foreground truncate text-xs" title={webhook.url}>
                      {webhook.url}
                    </code>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Ativo</span>
                    <Switch checked={webhook.ativo} disabled={isPending} onCheckedChange={(valor) => alternarAtivo(webhook, valor)} />
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {webhook.eventos.map((evento) => (
                    <Badge key={evento} variant="secondary">
                      {isWebhookEvento(evento) ? WEBHOOK_EVENTO_LABELS[evento] : evento}
                    </Badge>
                  ))}
                </div>

                <p className="text-muted-foreground text-xs">
                  {webhook.cursos_ids.length === 0
                    ? "Todos os cursos"
                    : `Cursos: ${webhook.cursos_ids.map((id) => nomeCurso.get(id) ?? "curso removido").join(", ")}`}
                </p>

                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVerLogs(webhook)}>
                    <History />
                    Ver logs
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(webhook)}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Excluir ${webhook.nome}`}
                    title="Excluir webhook"
                    onClick={() => setExcluindo(webhook)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editando !== undefined && (
        <WebhookDialog
          // key: cada abertura (novo / outro webhook) recomeça o formulário do zero.
          key={editando?.id ?? "novo"}
          webhook={editando}
          cursos={cursos}
          onClose={() => setEditando(undefined)}
        />
      )}

      {verLogs && <WebhookLogsDialog webhookId={verLogs.id} nome={verLogs.nome} onClose={() => setVerLogs(null)} />}

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{excluindo?.nome}&quot;? Ele deixa de receber eventos e o histórico de
              entregas dele também é apagado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={confirmarExclusao}>
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
