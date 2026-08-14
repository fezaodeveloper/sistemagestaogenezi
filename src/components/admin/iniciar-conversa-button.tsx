"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function IniciarConversaButton({
  alunoId,
  action,
}: {
  alunoId: string;
  action: (alunoId: string) => Promise<{ error?: string } | void>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setErro(null);
    startTransition(async () => {
      const result = await action(alunoId);
      if (result?.error) setErro(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button disabled={isPending} onClick={handleClick}>
        {isPending ? "Iniciando..." : "Iniciar conversa"}
      </Button>
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
    </div>
  );
}
