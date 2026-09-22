"use client";

// "use client": toggle ativo, duplicar e excluir (com confirmação) direto no card.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { alternarFluxoAtivo, duplicarFluxo, excluirFluxo } from "@/app/admin/whatsapp-fluxos/actions";
import { FLUXO_GATILHO_LABELS, type FluxoGatilho } from "@/lib/whatsapp/fluxos-tipos";
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

export type FluxoCardView = {
  id: string;
  nome: string;
  descricao: string | null;
  gatilho: FluxoGatilho;
  ativo: boolean;
  totalExecucoes: number;
};

export function WhatsappFluxoCard({ fluxo }: { fluxo: FluxoCardView }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(fluxo.ativo);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  function alternar(novoValor: boolean) {
    setErro(null);
    const anterior = ativo;
    setAtivo(novoValor);
    startTransition(async () => {
      const r = await alternarFluxoAtivo(fluxo.id, novoValor);
      if ("error" in r) {
        setAtivo(anterior);
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const r = await duplicarFluxo(fluxo.id);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function excluir() {
    startTransition(async () => {
      const r = await excluirFluxo(fluxo.id);
      if ("error" in r) {
        setErro(r.error);
        setConfirmandoExcluir(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/admin/whatsapp-fluxos/${fluxo.id}`} className="truncate text-sm font-medium hover:underline">
              {fluxo.nome}
            </Link>
            <Badge variant="outline" className="w-fit">
              {FLUXO_GATILHO_LABELS[fluxo.gatilho]}
            </Badge>
          </div>
          <Switch checked={ativo} onCheckedChange={alternar} disabled={pendente} aria-label={ativo ? `Desativar ${fluxo.nome}` : `Ativar ${fluxo.nome}`} />
        </div>

        {fluxo.descricao && <p className="text-muted-foreground line-clamp-2 text-xs">{fluxo.descricao}</p>}

        <p className="text-muted-foreground text-xs">
          {fluxo.totalExecucoes} {fluxo.totalExecucoes === 1 ? "execução" : "execuções"}
        </p>

        {erro && (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button size="sm" variant="outline" render={<Link href={`/admin/whatsapp-fluxos/${fluxo.id}`} />} nativeButton={false}>
            <Pencil />
            Editar
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pendente} onClick={duplicar}>
            <Copy />
            Duplicar
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={() => setConfirmandoExcluir(true)}>
            <Trash2 />
            Excluir
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmandoExcluir} onOpenChange={(v) => !pendente && setConfirmandoExcluir(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{fluxo.nome}</strong>? As execuções já registradas também são apagadas. Esta ação não pode ser desfeita.
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
