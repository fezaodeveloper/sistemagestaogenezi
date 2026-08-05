"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteModulo } from "@/app/admin/cursos/[id]/modulos/actions";
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

export function DeleteModuloButton({
  cursoId,
  moduloId,
  titulo,
}: {
  cursoId: string;
  moduloId: string;
  titulo: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteModulo(cursoId, moduloId);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
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
          <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${titulo}`}>
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir módulo</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{titulo}&quot;? As aulas e materiais desse módulo
            também serão excluídos. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
