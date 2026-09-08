"use client";

import { useState, useTransition } from "react";
import { salvarConfigGamificacao, type ConfigGamificacaoValues } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfiguracoesGamificacaoForm({
  defaultValues,
}: {
  defaultValues: ConfigGamificacaoValues;
}) {
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await salvarConfigGamificacao(formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Pontos por ação</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pts_aula_concluida">Aula concluída</Label>
            <Input
              id="pts_aula_concluida"
              name="pts_aula_concluida"
              type="number"
              min={0}
              defaultValue={defaultValues.pts_aula_concluida}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pts_quiz_concluido">Quiz completado (nota 100%)</Label>
            <Input
              id="pts_quiz_concluido"
              name="pts_quiz_concluido"
              type="number"
              min={0}
              defaultValue={defaultValues.pts_quiz_concluido}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pts_nota_maxima">Prova completada (nota 100%)</Label>
            <Input
              id="pts_nota_maxima"
              name="pts_nota_maxima"
              type="number"
              min={0}
              defaultValue={defaultValues.pts_nota_maxima}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pts_presenca">Presença registrada</Label>
            <Input
              id="pts_presenca"
              name="pts_presenca"
              type="number"
              min={0}
              defaultValue={defaultValues.pts_presenca}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pts_modulo_concluido">Módulo concluído</Label>
            <Input
              id="pts_modulo_concluido"
              name="pts_modulo_concluido"
              type="number"
              min={0}
              defaultValue={defaultValues.pts_modulo_concluido}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pts_curso_concluido">Curso concluído</Label>
            <Input
              id="pts_curso_concluido"
              name="pts_curso_concluido"
              type="number"
              min={0}
              defaultValue={defaultValues.pts_curso_concluido}
              required
            />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Quiz e prova dão pontos proporcionais à nota — os valores acima são o teto (nota 100%). Uma
          nota de 50%, por exemplo, vale metade dos pontos.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Limites</h3>
        <div className="flex flex-col gap-2 sm:max-w-60">
          <Label htmlFor="limite_pts_dia">Limite de pontos por dia</Label>
          <Input
            id="limite_pts_dia"
            name="limite_pts_dia"
            type="number"
            min={0}
            defaultValue={defaultValues.limite_pts_dia}
            required
          />
        </div>
        <p className="text-muted-foreground text-sm">
          Evita farm excessivo de pontos.{" "}
          <span className="font-medium">Ainda não aplicado</span> — o valor fica salvo aqui, pronto
          pra quando a checagem de teto diário for implementada nas rotinas de pontuação.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {salvo && !error && <p className="text-sm text-green-600 dark:text-green-400">Salvo com sucesso.</p>}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar configurações de gamificação"}
        </Button>
      </div>
    </form>
  );
}
