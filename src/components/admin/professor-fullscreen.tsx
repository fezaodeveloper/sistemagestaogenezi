"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Overlay genérico de tela cheia do Painel do Professor — usado tanto para
// o player de vídeo quanto para o visualizador de PDF (ver professor-view.tsx),
// cada um passando seu próprio iframe como children. Fecha com o X ou Esc.
export function ProfessorFullscreen({
  titulo,
  onClose,
  children,
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="animate-in fade-in zoom-in-95 fixed inset-0 z-50 flex items-center justify-center bg-black/95 duration-200"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar tela cheia"
        className="absolute top-4 right-4 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-7" />
      </button>
      <div className="flex h-[90vh] w-[90vw] items-center justify-center">{children}</div>
    </div>
  );
}
