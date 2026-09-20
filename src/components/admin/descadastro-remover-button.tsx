"use client";

// "use client": diálogo de confirmação e Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { removerDescadastro } from "@/app/admin/email-marketing/descadastros/actions";
import { Button } from "@/components/ui/button";
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

export function DescadastroRemoverButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await removerDescadastro(id);
      if (r.error) {
        setErro(r.error);
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        <Undo2 />
        Remover da lista
      </Button>
      <AlertDialog open={aberto} onOpenChange={(proximo) => !isPending && setAberto(proximo)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da lista de descadastrados</AlertDialogTitle>
            <AlertDialogDescription>
              Reativar <strong>{email}</strong>? Este endereço volta a receber e-mails de marketing nas próximas campanhas. Faça isso
              só se a própria pessoa pediu para voltar a receber — ela se descadastrou por vontade própria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={confirmar}>
              {isPending ? "Reativando..." : "Reativar e-mail"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
