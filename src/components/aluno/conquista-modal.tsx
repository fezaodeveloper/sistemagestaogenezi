"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type ConquistaBadge = { nome: string; descricao: string; icone: string };

const CORES_CONFETE = ["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#2DD4A0", "#FFB020"];

type Particula = { left: number; delay: number; duracao: number; cor: string };

// Pontos coloridos caindo do topo — Math.random é uma função impura, por
// isso a geração roda num efeito pós-montagem (não durante o render), uma
// única vez; sem isso violaria a regra de pureza de render do React.
function Confetes() {
  const [particulas, setParticulas] = useState<Particula[]>([]);

  useEffect(() => {
    // Side-effect real (Math.random é impuro) — mesmo caso documentado em
    // aluno-create-form.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticulas(
      Array.from({ length: 14 }, (_, indice) => ({
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 400),
        duracao: 1400 + Math.round(Math.random() * 900),
        cor: CORES_CONFETE[indice % CORES_CONFETE.length],
      })),
    );
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particulas.map((particula, indice) => (
        <span
          key={indice}
          className="animate-conquista-confete absolute top-0 size-2 rounded-full"
          style={{
            left: `${particula.left}%`,
            backgroundColor: particula.cor,
            animationDelay: `${particula.delay}ms`,
            animationDuration: `${particula.duracao}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Modal estilo Duolingo, exibido quando o aluno ganha uma ou mais medalhas
// de uma vez — mostra uma por vez (fila), sempre com a mesma animação de
// entrada. CSS puro (keyframes em globals.css), sem biblioteca de animação.
export function ConquistaModal({
  badges,
  onClose,
}: {
  badges: ConquistaBadge[];
  onClose: () => void;
}) {
  const [indice, setIndice] = useState(0);

  if (badges.length === 0) return null;
  const badge = badges[indice];
  const ultima = indice === badges.length - 1;

  function handleContinuar() {
    if (ultima) {
      onClose();
    } else {
      setIndice((atual) => atual + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        key={indice}
        className="relative flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-2xl bg-card p-8 text-center shadow-2xl"
      >
        <Confetes />

        <span
          className="animate-conquista-glow animate-conquista-pop relative flex size-32 items-center justify-center rounded-full bg-amber-500/10 text-8xl"
          style={{ lineHeight: 1 }}
        >
          {badge.icone}
        </span>

        <span className="text-sm font-extrabold tracking-widest text-amber-500 uppercase">
          Nova conquista!
        </span>

        <h2 className="text-xl font-bold">{badge.nome}</h2>
        <p className="text-muted-foreground text-sm">{badge.descricao}</p>

        {badges.length > 1 && (
          <span className="text-muted-foreground text-xs">
            {indice + 1} de {badges.length}
          </span>
        )}

        <Button type="button" className="w-full" onClick={handleContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
