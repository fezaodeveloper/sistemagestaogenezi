"use client";

import { useConquistas } from "@/hooks/useConquistas";
import { ConquistaModal } from "@/components/aluno/conquista-modal";

export function ConquistasProvider({ alunoId }: { alunoId: string }) {
  const { novasMedalhas, limpar } = useConquistas(alunoId);

  if (novasMedalhas.length === 0) return null;

  return <ConquistaModal badges={novasMedalhas} onClose={limpar} />;
}
