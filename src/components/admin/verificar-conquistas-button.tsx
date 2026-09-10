"use client";

import { useState, useTransition } from "react";
import { forcarVerificacaoBadgesAluno } from "@/app/admin/alunos/actions";
import { Button } from "@/components/ui/button";

export function VerificarConquistasButton({ alunoId }: { alunoId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feito, setFeito] = useState(false);

  function handleClick() {
    setFeito(false);
    startTransition(async () => {
      await forcarVerificacaoBadgesAluno(alunoId);
      setFeito(true);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" disabled={isPending} onClick={handleClick}>
        🔄 {isPending ? "Verificando..." : "Verificar conquistas"}
      </Button>
      {feito && !isPending && (
        <p className="text-sm text-green-600 dark:text-green-400">Conquistas verificadas.</p>
      )}
    </div>
  );
}
