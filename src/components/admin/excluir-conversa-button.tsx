"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

// A action redireciona pra /admin/chat em caso de sucesso — só volta um
// valor pra esse componente tratar quando dá erro antes do redirect (mesmo
// padrão de iniciarOuAbrirConversaAdmin + IniciarConversaButton).
export function ExcluirConversaButton({
  conversaId,
  action,
}: {
  conversaId: string;
  action: (conversaId: string) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await action(conversaId);
      if (resultado?.error) {
        setError(resultado.error);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setConfirmacao("");
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="text-destructive">
            <Trash2 />
            Excluir conversa
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza? Todas as mensagens desta conversa serão excluídas permanentemente. Esta ação não
            pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmacao-exclusao-conversa" className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id="confirmacao-exclusao-conversa"
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Digite EXCLUIR para confirmar"
            autoComplete="off"
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || confirmacao !== TEXTO_CONFIRMACAO_EXCLUSAO}
            onClick={handleExcluir}
          >
            {isPending ? "Excluindo..." : "Excluir conversa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
