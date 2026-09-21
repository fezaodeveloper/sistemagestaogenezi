"use client";

// "use client": fila do modal, animação, área de transferência e navegação.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Share2 } from "lucide-react";
import type { ConquistaNovaView } from "@/lib/conquistas/tipos";
import { Confetes } from "@/components/aluno/conquista-modal";
import { ConquistaBadgeImagem } from "@/components/aluno/conquista-badge-imagem";
import { Button } from "@/components/ui/button";

// Celebração de conquista PERSONALIZADA desbloqueada (uma por vez, em fila). Reaproveita as
// animações CSS e os confetes do modal de medalhas (globals.css) — z-index acima dele caso
// os dois apareçam juntos.
export function ConquistaDesbloqueadaModal({
  conquistas,
  onClose,
}: {
  conquistas: ConquistaNovaView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const [copiado, setCopiado] = useState(false);

  if (conquistas.length === 0) return null;
  const conquista = conquistas[Math.min(indice, conquistas.length - 1)];
  const ultima = indice >= conquistas.length - 1;

  async function compartilhar() {
    const texto = `🏆 Desbloqueei a conquista "${conquista.titulo}" no Portal do Aluno!`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Área de transferência indisponível (permissão/contexto inseguro): ignora.
    }
  }

  function verTodas() {
    onClose();
    router.push("/aluno/conquistas");
  }

  function proxima() {
    setCopiado(false);
    setIndice((atual) => atual + 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Conquista desbloqueada: ${conquista.titulo}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
    >
      <div
        key={indice}
        className="bg-card relative flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-2xl p-8 text-center shadow-2xl"
      >
        <Confetes />

        <span className="animate-conquista-glow animate-conquista-pop relative rounded-full">
          <ConquistaBadgeImagem url={conquista.badgeUrl} emoji={conquista.badgeEmoji} titulo={conquista.titulo} className="size-32 text-7xl" />
        </span>

        <span className="text-sm font-extrabold tracking-widest text-amber-500 uppercase">Conquista desbloqueada!</span>

        <h2 className="text-xl font-bold break-words">{conquista.titulo}</h2>
        {conquista.descricao && <p className="text-muted-foreground text-sm break-words">{conquista.descricao}</p>}

        {conquistas.length > 1 && (
          <span className="text-muted-foreground text-xs">
            {Math.min(indice, conquistas.length - 1) + 1} de {conquistas.length}
          </span>
        )}

        <div className="flex w-full flex-col gap-2">
          <Button type="button" className="w-full" onClick={verTodas}>
            Ver todas as conquistas
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={compartilhar}>
            {copiado ? <Check /> : <Share2 />}
            {copiado ? "Texto copiado!" : "Compartilhar"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={ultima ? onClose : proxima}>
            {ultima ? "Fechar" : "Próxima conquista"}
          </Button>
        </div>
      </div>
    </div>
  );
}
