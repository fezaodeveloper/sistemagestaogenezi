"use client";

// "use client": estado dos sliders e Server Action de salvar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarAntiBanimento } from "@/app/admin/configuracoes/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function WhatsappAntibanimentoForm({ minInicial, maxInicial }: { minInicial: number; maxInicial: number }) {
  const router = useRouter();
  const [min, setMin] = useState(minInicial);
  const [max, setMax] = useState(maxInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, startTransition] = useTransition();

  const alterado = min !== minInicial || max !== maxInicial;
  const invalido = max < min;

  function salvar() {
    setErro(null);
    setOk(false);
    if (invalido) {
      setErro("O delay máximo não pode ser menor que o mínimo.");
      return;
    }
    startTransition(async () => {
      const r = await salvarAntiBanimento({ delayMinSegundos: min, delayMaxSegundos: max });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        Delays aleatórios (entre o mínimo e o máximo) evitam banimento do número pelo WhatsApp ao enviar várias mensagens em sequência.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="wa-delay-min">Delay mínimo entre mensagens</Label>
          <span className="text-sm font-medium tabular-nums">{min}s</span>
        </div>
        <input
          id="wa-delay-min"
          type="range"
          min={1}
          max={10}
          step={1}
          value={min}
          onChange={(e) => {
            setMin(Number(e.target.value));
            setOk(false);
          }}
          disabled={salvando}
          className="accent-primary max-w-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="wa-delay-max">Delay máximo entre mensagens</Label>
          <span className="text-sm font-medium tabular-nums">{max}s</span>
        </div>
        <input
          id="wa-delay-max"
          type="range"
          min={1}
          max={30}
          step={1}
          value={max}
          onChange={(e) => {
            setMax(Number(e.target.value));
            setOk(false);
          }}
          disabled={salvando}
          className="accent-primary max-w-sm"
        />
      </div>

      {invalido && (
        <p role="alert" className="text-destructive text-sm">
          O delay máximo não pode ser menor que o mínimo.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={salvar} disabled={salvando || !alterado || invalido}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
        {ok && !alterado && (
          <span role="status" className="text-sm text-green-600 dark:text-green-400">
            Salvo.
          </span>
        )}
        {erro && !invalido && (
          <span role="alert" className="text-destructive text-sm">
            {erro}
          </span>
        )}
      </div>
    </div>
  );
}
