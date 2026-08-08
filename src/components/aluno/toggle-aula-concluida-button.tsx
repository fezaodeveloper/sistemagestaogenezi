"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleAulaConcluida } from "@/app/aluno/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/actions";
import { Button } from "@/components/ui/button";

export function ToggleAulaConcluidaButton({
  cursoId,
  moduloId,
  aulaId,
  concluidaInicial,
}: {
  cursoId: string;
  moduloId: string;
  aulaId: string;
  concluidaInicial: boolean;
}) {
  const [concluida, setConcluida] = useState(concluidaInicial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await toggleAulaConcluida(cursoId, moduloId, aulaId, concluida);
      if (result.error) {
        setError(result.error);
      } else {
        setConcluida((prev) => !prev);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={concluida ? "outline" : "default"}
        onClick={handleClick}
        disabled={isPending}
      >
        <Check />
        {concluida ? "Aula concluída" : "Marcar aula como concluída"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
