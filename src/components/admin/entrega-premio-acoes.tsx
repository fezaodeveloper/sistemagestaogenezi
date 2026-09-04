"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";
import {
  dispararWhatsappStubEntrega,
  marcarEntregaEntregue,
  reenviarEmailEntrega,
} from "@/app/admin/resgates/actions";
import {
  ENTREGA_STATUS_BADGE_CLASS,
  ENTREGA_STATUS_LABELS,
  ENTREGA_TIPO_LABELS,
  type EntregaPremio,
} from "@/lib/creditos/resgates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MENSAGEM_WHATSAPP_STUB =
  "Integração com WhatsApp em breve. Esta funcionalidade será habilitada com a API Evolution.";

function MarcarEntregueDialog({ entregaId }: { entregaId: string }) {
  const [open, setOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const resultado = await marcarEntregaEntregue(entregaId, observacoes);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      setObservacoes("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Marcar entregue</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar entrega como concluída</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`observacoes-${entregaId}`}>Observações</Label>
          <Textarea
            id={`observacoes-${entregaId}`}
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            placeholder="Opcional"
            rows={3}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" disabled={isPending} onClick={handleConfirmar}>
            {isPending ? "Salvando..." : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReenviarEmailButton({ entregaId }: { entregaId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReenviar() {
    setError(null);
    startTransition(async () => {
      const resultado = await reenviarEmailEntrega(entregaId);
      if (resultado.error) setError(resultado.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleReenviar}>
        <Send />
        {isPending ? "Reenviando..." : "Reenviar email"}
      </Button>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

function WhatsappStubButtonEntrega({
  entregaId,
  nomeAluno,
  nomePremio,
}: {
  entregaId: string;
  nomeAluno: string;
  nomePremio: string;
}) {
  function handleClick() {
    void dispararWhatsappStubEntrega(entregaId, nomeAluno, nomePremio);
    window.alert(MENSAGEM_WHATSAPP_STUB);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-green-500/30 text-green-600 opacity-80 hover:bg-green-500/10 hover:text-green-700 hover:opacity-100 dark:text-green-400 dark:hover:text-green-300"
      onClick={handleClick}
    >
      <MessageCircle />
      WhatsApp
    </Button>
  );
}

// Uma linha por entrega (um resgate pode ter mais de uma — ex.: email +
// whatsapp, num prêmio híbrido) — cada uma com seu próprio badge de status
// e ação contextual (nem toda combinação tipo/status tem uma ação: uma
// entrega já 'entregue' ou 'enviado' com sucesso só mostra o badge).
export function EntregaPremioAcoes({
  entregas,
  nomeAluno,
  nomePremio,
}: {
  entregas: EntregaPremio[];
  nomeAluno: string;
  nomePremio: string;
}) {
  if (entregas.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {entregas.map((entrega) => (
        <div key={entrega.id} className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">{ENTREGA_TIPO_LABELS[entrega.tipo_entrega]}:</span>
            <Badge className={ENTREGA_STATUS_BADGE_CLASS[entrega.status]}>
              {ENTREGA_STATUS_LABELS[entrega.status]}
            </Badge>
          </div>
          {entrega.tipo_entrega === "fisico" && entrega.status === "pendente" && (
            <MarcarEntregueDialog entregaId={entrega.id} />
          )}
          {entrega.tipo_entrega === "email" && entrega.status === "falhou" && (
            <ReenviarEmailButton entregaId={entrega.id} />
          )}
          {entrega.tipo_entrega === "whatsapp" && entrega.status === "pendente" && (
            <WhatsappStubButtonEntrega entregaId={entrega.id} nomeAluno={nomeAluno} nomePremio={nomePremio} />
          )}
        </div>
      ))}
    </div>
  );
}
