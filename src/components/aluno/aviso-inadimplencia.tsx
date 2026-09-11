"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_STORAGE_KEY = "genezi-aviso-inadimplencia-dismissed-date";

export function AvisoInadimplencia({ creditosDisponiveis }: { creditosDisponiveis: number }) {
  const [dismissed, setDismissed] = useState(false);

  // Fecha "por hoje" — guarda a data de hoje no localStorage, então o aviso
  // volta a aparecer na próxima sessão (dia seguinte), não fica escondido
  // pra sempre. Leitura pós-montagem, mesmo padrão já usado pros toggles de
  // KPI (evita hydration mismatch, já que localStorage só existe no client).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(DISMISS_STORAGE_KEY);
      const hoje = new Date().toISOString().slice(0, 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo === hoje) setDismissed(true);
    } catch {
      // Best-effort — sem localStorage disponível, o aviso só não fecha sozinho.
    }
  }, []);

  function handleFechar() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, new Date().toISOString().slice(0, 10));
    } catch {
      // Best-effort — ver comentário acima.
    }
  }

  if (dismissed) return null;

  return (
    <div className="relative flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 pr-10 text-sm text-amber-200">
      <button
        type="button"
        onClick={handleFechar}
        aria-label="Fechar aviso"
        className="absolute top-2 right-2 rounded-md p-1 text-amber-200/70 transition-colors hover:bg-amber-500/15 hover:text-amber-100"
      >
        <X className="size-4" />
      </button>
      <p>
        🔔 Sua pontuação está temporariamente pausada. Para voltar a acumular pontos e créditos, verifique
        sua situação financeira com a secretaria.
      </p>
      {creditosDisponiveis > 0 && (
        <p>
          💡 Você tem <span className="font-semibold">{creditosDisponiveis}</span> créditos disponíveis
          para resgatar. Não se esqueça de trocar por prêmios!
        </p>
      )}
    </div>
  );
}
