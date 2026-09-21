"use client";

// "use client": busca as conquistas novas ao carregar/navegar/ouvir evento e controla a fila do modal.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buscarConquistasNovas, marcarConquistasVistas } from "@/app/aluno/conquistas/actions";
import type { ConquistaNovaView } from "@/lib/conquistas/tipos";
import { ConquistaDesbloqueadaModal } from "@/components/aluno/conquista-desbloqueada-modal";

// Evento que os pontos de ação do aluno disparam (ex.: marcar aula como concluída) para o
// modal aparecer NA HORA, sem esperar a próxima navegação.
export const EVENTO_VERIFICAR_CONQUISTAS = "genezi:conquistas";

// Montado uma vez no layout do aluno (só com "Habilitar conquistas" ligado). Independente do
// ConquistasProvider das medalhas: cada sistema tem a própria fila e o próprio modal.
export function ConquistasPersonalizadasProvider() {
  const pathname = usePathname();
  const [fila, setFila] = useState<ConquistaNovaView[]>([]);
  const emAndamento = useRef(false);

  const verificar = useCallback(async () => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    try {
      const novas = await buscarConquistasNovas();
      // Com o modal já aberto não troca a fila embaixo do aluno.
      if (novas.length > 0) setFila((atual) => (atual.length > 0 ? atual : novas));
    } finally {
      emAndamento.current = false;
    }
  }, []);

  useEffect(() => {
    void verificar();
  }, [pathname, verificar]);

  useEffect(() => {
    const aoEvento = () => void verificar();
    window.addEventListener(EVENTO_VERIFICAR_CONQUISTAS, aoEvento);
    return () => window.removeEventListener(EVENTO_VERIFICAR_CONQUISTAS, aoEvento);
  }, [verificar]);

  function fechar() {
    const ids = fila.map((c) => c.desbloqueioId);
    setFila([]);
    void marcarConquistasVistas(ids);
  }

  if (fila.length === 0) return null;
  return <ConquistaDesbloqueadaModal conquistas={fila} onClose={fechar} />;
}
