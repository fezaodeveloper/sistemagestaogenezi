"use client";

// "use client": estado otimista do botão e Server Action de curtir/descurtir.

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { alternarCurtida } from "@/app/aluno/comunidade/actions";
import { Button } from "@/components/ui/button";

export function ComunidadeCurtirButton({
  alvo,
  id,
  curtidoInicial,
  totalInicial,
}: {
  alvo: "post" | "resposta";
  id: string;
  curtidoInicial: boolean;
  totalInicial: number;
}) {
  const [curtido, setCurtido] = useState(curtidoInicial);
  const [total, setTotal] = useState(totalInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function alternar() {
    setErro(null);
    // Otimista: atualiza na hora e volta atrás se a action falhar.
    const anterior = { curtido, total };
    setCurtido(!curtido);
    setTotal(Math.max(0, total + (curtido ? -1 : 1)));

    startTransition(async () => {
      const r = await alternarCurtida(alvo, id);
      if ("error" in r) {
        setCurtido(anterior.curtido);
        setTotal(anterior.total);
        setErro(r.error);
        return;
      }
      setCurtido(r.curtido);
      setTotal(r.total);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={curtido ? "default" : "outline"}
        size="sm"
        onClick={alternar}
        disabled={pendente}
        aria-pressed={curtido}
        aria-label={curtido ? "Descurtir" : "Curtir"}
      >
        <Heart className={curtido ? "fill-current" : undefined} />
        {total}
      </Button>
      {erro && (
        <span role="alert" className="text-destructive text-xs">
          {erro}
        </span>
      )}
    </span>
  );
}
