"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { duplicarPremio } from "@/app/admin/premios/actions";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DuplicarPremioButton({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDuplicar() {
    setError(null);
    startTransition(async () => {
      const resultado = await duplicarPremio(id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      router.push(`/admin/premios/${resultado.id}/editar`);
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
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Duplicar ${nome}`} title="Duplicar prêmio">
            <Copy />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicar prêmio</AlertDialogTitle>
          <AlertDialogDescription>
            Criar uma cópia de &quot;{nome}&quot; com todos os campos (inclusive foto e arquivo de entrega)? A cópia
            terá &quot;(cópia)&quot; no nome e será aberta para edição.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleDuplicar}>
            {isPending ? "Duplicando..." : "Duplicar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
