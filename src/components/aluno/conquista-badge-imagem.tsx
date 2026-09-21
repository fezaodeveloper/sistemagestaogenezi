import { Lock } from "lucide-react";
import { EMOJI_PADRAO_CONQUISTA } from "@/lib/conquistas/tipos";

// Badge de uma conquista: imagem personalizada, ou emoji, ou 🏆 se nenhum dos dois. Sem
// estado (usado tanto em Server quanto em Client Components). `bloqueada` = cinza + cadeado.
export function ConquistaBadgeImagem({
  url,
  emoji,
  titulo,
  bloqueada = false,
  className = "size-20 text-5xl",
}: {
  url: string | null;
  emoji: string | null;
  titulo: string;
  bloqueada?: boolean;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}>
      <span
        className={`flex size-full items-center justify-center overflow-hidden rounded-full ${
          bloqueada ? "bg-muted grayscale" : "bg-amber-500/10"
        }`}
        style={{ lineHeight: 1 }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do Storage do próprio projeto
          <img src={url} alt={titulo} className={`size-full object-cover ${bloqueada ? "opacity-40" : ""}`} />
        ) : (
          <span className={bloqueada ? "opacity-40" : undefined}>{emoji || EMOJI_PADRAO_CONQUISTA}</span>
        )}
      </span>
      {bloqueada && (
        <span className="bg-background text-muted-foreground absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border shadow-sm">
          <Lock className="size-3.5" />
        </span>
      )}
    </span>
  );
}
