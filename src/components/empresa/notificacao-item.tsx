"use client";

import { useTransition } from "react";
import { marcarNotificacaoLida } from "@/app/empresa/(protegido)/notificacoes/actions";
import type { NotificacaoEmpresa } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function NotificacaoItem({ notificacao }: { notificacao: NotificacaoEmpresa }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className={notificacao.lida ? "opacity-70" : undefined}>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{notificacao.titulo}</span>
          {!notificacao.lida && <Badge className="bg-blue-500/90 text-white">Nova</Badge>}
        </div>
        <p className="text-sm">{notificacao.mensagem}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">{formatDateBR(notificacao.created_at)}</span>
          {!notificacao.lida && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await marcarNotificacaoLida(notificacao.id);
                })
              }
            >
              Marcar como lida
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
