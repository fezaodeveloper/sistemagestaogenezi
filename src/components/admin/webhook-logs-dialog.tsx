"use client";

// "use client": carrega o histórico sob demanda ao abrir e permite atualizar.

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { listarLogsWebhook, type LogWebhook } from "@/app/admin/configuracoes/apps/webhooks/actions";
import { WEBHOOK_EVENTO_LABELS, isWebhookEvento } from "@/lib/webhooks/eventos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_CLASSE: Record<LogWebhook["status"], string> = {
  entregue: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  falhou: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  pendente: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

const STATUS_LABEL: Record<LogWebhook["status"], string> = {
  entregue: "Entregue",
  falhou: "Falhou",
  pendente: "Pendente",
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function WebhookLogsDialog({ webhookId, nome, onClose }: { webhookId: string; nome: string; onClose: () => void }) {
  const [logs, setLogs] = useState<LogWebhook[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const resultado = await listarLogsWebhook(webhookId);
    if ("error" in resultado) setErro(resultado.error);
    else setLogs(resultado.logs);
    setCarregando(false);
  }, [webhookId]);

  useEffect(() => {
    // queueMicrotask evita setState síncrono no corpo do efeito (react-hooks/set-state-in-effect).
    queueMicrotask(() => void carregar());
  }, [carregar]);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Entregas — {nome}</DialogTitle>
          <DialogDescription>Os 50 disparos mais recentes deste webhook.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={carregar} disabled={carregando}>
            <RefreshCw className={carregando ? "animate-spin" : undefined} />
            Atualizar
          </Button>
        </div>

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}

        {logs === null && !erro ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Carregando...</p>
        ) : logs !== null && logs.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhum disparo registrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(logs ?? []).map((log) => (
              <li key={log.id} className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {isWebhookEvento(log.evento) ? WEBHOOK_EVENTO_LABELS[log.evento] : log.evento}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{formatarDataHora(log.created_at)}</span>
                    <Badge className={STATUS_CLASSE[log.status]}>{STATUS_LABEL[log.status]}</Badge>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  {log.tentativas} tentativa(s)
                  {log.resposta_status !== null && ` · HTTP ${log.resposta_status}`}
                </p>
                {log.resposta_body && (
                  <p className="text-muted-foreground line-clamp-2 text-xs break-all" title={log.resposta_body}>
                    Resposta: {log.resposta_body}
                  </p>
                )}
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer">Ver payload enviado</summary>
                  <pre className="bg-muted mt-1 max-h-48 overflow-auto rounded-md p-2 text-[11px]">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
