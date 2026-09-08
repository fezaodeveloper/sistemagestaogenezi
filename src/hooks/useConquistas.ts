"use client";

import { useEffect, useState } from "react";
import { getNovasMedalhas, type NovaMedalha } from "@/app/aluno/gamificacao/actions";

const STORAGE_KEY = "genezi-conquistas-exibidas";

function getExibidas(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function salvarExibidas(exibidas: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...exibidas]));
  } catch {}
}

// Verifica badges novos uma única vez por montagem (ver ConquistasProvider,
// montado uma vez no layout do aluno) — não repete em re-renders. Um badge
// só é marcado como "exibido" em localStorage quando o modal é de fato
// fechado (limpar()), não assim que detectado.
export function useConquistas(alunoId: string) {
  const [novasMedalhas, setNovasMedalhas] = useState<NovaMedalha[]>([]);

  useEffect(() => {
    let cancelado = false;

    getNovasMedalhas(alunoId).then((medalhas) => {
      if (cancelado) return;
      const exibidas = getExibidas();
      const novas = medalhas.filter((medalha) => !exibidas.has(medalha.badgeId));
      if (novas.length > 0) setNovasMedalhas(novas);
    });

    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  function limpar() {
    if (novasMedalhas.length > 0) {
      const exibidas = getExibidas();
      for (const medalha of novasMedalhas) exibidas.add(medalha.badgeId);
      salvarExibidas(exibidas);
    }
    setNovasMedalhas([]);
  }

  return { novasMedalhas, limpar };
}
