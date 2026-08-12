"use client";

import { useState, useTransition } from "react";
import { updateCriteriosCertificado } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CriteriosCertificadoForm({
  notaMinimaInicial,
  frequenciaMinimaInicial,
}: {
  notaMinimaInicial: number;
  frequenciaMinimaInicial: number;
}) {
  const [notaMinima, setNotaMinima] = useState(notaMinimaInicial);
  const [frequenciaMinima, setFrequenciaMinima] = useState(frequenciaMinimaInicial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const result = await updateCriteriosCertificado(notaMinima, frequenciaMinima);
      if (result.error) setError(result.error);
      else setSalvo(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nota-minima">Nota mínima nas provas (%)</Label>
        <Input
          id="nota-minima"
          type="number"
          min={0}
          max={100}
          value={notaMinima}
          onChange={(e) => setNotaMinima(Number(e.target.value))}
          className="max-w-32"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="frequencia-minima">Frequência mínima — presencial/híbrido (%)</Label>
        <Input
          id="frequencia-minima"
          type="number"
          min={0}
          max={100}
          value={frequenciaMinima}
          onChange={(e) => setFrequenciaMinima(Number(e.target.value))}
          className="max-w-32"
        />
      </div>
      <p className="text-muted-foreground text-sm">
        Um aluno só recebe o certificado quando conclui 100% do curso, atinge a nota mínima em
        todas as provas e — em cursos presenciais ou híbridos — atinge a frequência mínima. Cursos
        EAD não têm checagem de frequência.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        {salvo && !error && <span className="text-muted-foreground text-sm">Salvo.</span>}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
