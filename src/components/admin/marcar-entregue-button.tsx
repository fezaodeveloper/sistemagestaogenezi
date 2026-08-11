"use client";

import { useState, useTransition } from "react";
import { marcarResgateEntregue } from "@/app/admin/resgates/actions";
import { Button } from "@/components/ui/button";

export function MarcarEntregueButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await marcarResgateEntregue(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? "Salvando..." : "Marcar como entregue"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
