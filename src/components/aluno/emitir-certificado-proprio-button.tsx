"use client";

import { useState, useTransition } from "react";
import { emitirCertificadoProprio } from "@/app/aluno/certificados/actions";
import { Button } from "@/components/ui/button";

export function EmitirCertificadoProprioButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await emitirCertificadoProprio(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? "Emitindo..." : "Emitir meu certificado"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
