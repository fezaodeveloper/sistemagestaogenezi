import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

// Pôster 2:3 do curso — ou um placeholder neutro (ícone sobre fundo
// muted) quando não há capa cadastrada, pra nunca quebrar o layout do
// grid/cabeçalho que espera essa proporção.
export function CursoCapa({
  capaUrl,
  nome,
  className,
}: {
  capaUrl: string | null;
  nome: string;
  className?: string;
}) {
  if (!capaUrl) {
    return (
      <div
        className={cn(
          "bg-muted flex aspect-2/3 items-center justify-center rounded-lg",
          className,
        )}
        role="img"
        aria-label={`Sem capa cadastrada para ${nome}`}
      >
        <GraduationCap className="text-muted-foreground size-8" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto de catálogo em bucket público, sem necessidade de otimização do next/image
    <img
      src={capaUrl}
      alt={`Capa do curso ${nome}`}
      className={cn("aspect-2/3 rounded-lg object-cover", className)}
    />
  );
}
