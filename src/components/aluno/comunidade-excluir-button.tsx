"use client";

// "use client": diálogo de confirmação e Server Action de exclusão.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { excluirPost, excluirResposta } from "@/app/aluno/comunidade/actions";
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

export function ComunidadeExcluirButton({
  tipo,
  id,
  // Depois de excluir um post a tela dele deixa de existir: vai para esta rota.
  aposExcluir,
}: {
  tipo: "post" | "resposta";
  id: string;
  aposExcluir?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const rotulo = tipo === "post" ? "post" : "resposta";

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = tipo === "post" ? await excluirPost(id) : await excluirResposta(id);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setAberto(false);
      if (aposExcluir) router.push(aposExcluir);
      else router.refresh();
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
        <Trash2 />
        Excluir
      </Button>
      <AlertDialog open={aberto} onOpenChange={(proximo) => !pendente && setAberto(proximo)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {rotulo}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? {tipo === "post" ? "O post e as respostas dele deixam de aparecer." : "A resposta deixa de aparecer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pendente} onClick={confirmar}>
              {pendente ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
