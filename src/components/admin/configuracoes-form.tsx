"use client";

import { useState, useTransition } from "react";
import { updateEadGamificacao } from "@/app/admin/configuracoes/actions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ConfiguracoesForm({ eadParticipaInicial }: { eadParticipaInicial: boolean }) {
  const [eadParticipa, setEadParticipa] = useState(eadParticipaInicial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(checked: boolean) {
    setEadParticipa(checked);
    setError(null);
    startTransition(async () => {
      const result = await updateEadGamificacao(checked);
      if (result.error) {
        setError(result.error);
        setEadParticipa(!checked); // reverte o toggle se salvar falhar
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Switch
          id="ead-gamificacao"
          checked={eadParticipa}
          onCheckedChange={handleChange}
          disabled={isPending}
        />
        <Label htmlFor="ead-gamificacao">Cursos EAD participam da gamificação</Label>
      </div>
      <p className="text-muted-foreground text-sm">
        Quando desligado, alunos matriculados só em cursos EAD não acumulam pontos nem aparecem no
        ranking geral. Cursos presenciais e híbridos continuam pontuando normalmente.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
