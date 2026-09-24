"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleAulaConcluida } from "@/app/aluno/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/actions";
import { EVENTO_VERIFICAR_CONQUISTAS } from "@/components/aluno/conquistas-personalizadas-provider";
import { Button } from "@/components/ui/button";

// AulaAvaliacao (irmão deste botão na barra de ações, não um ancestral em comum) escuta este
// evento pra aparecer/sumir na hora, sem esperar reload — mesmo idioma de EVENTO_VERIFICAR_CONQUISTAS
// acima, já usado no projeto pra comunicação entre componentes client irmãos.
export const EVENTO_AULA_CONCLUIDA_ALTERADA = "genezi:aula-concluida-alterada";

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
        const novoValor = !concluida;
        setConcluida(novoValor);
        // Marcou (não desmarcou): pode ter desbloqueado uma conquista — avisa o provider do
        // layout para mostrar o modal agora.
        if (novoValor) window.dispatchEvent(new Event(EVENTO_VERIFICAR_CONQUISTAS));
        window.dispatchEvent(
          new CustomEvent(EVENTO_AULA_CONCLUIDA_ALTERADA, { detail: { concluida: novoValor } }),
        );
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
