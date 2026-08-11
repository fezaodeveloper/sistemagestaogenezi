import { GraduationCap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ASPECT_CLASSES = {
  "2/3": "aspect-2/3",
  "16/9": "aspect-video",
} as const;

// Genérico: capa de curso (2:3, pôster) e capa de módulo (16:9,
// miniatura) usam o mesmo componente — só mudam a proporção e o ícone
// do placeholder. Placeholder é sempre um ícone sobre fundo muted, pra
// nunca quebrar o layout do grid/cabeçalho que espera essa proporção.
export function Capa({
  capaUrl,
  nome,
  aspect = "2/3",
  icone: Icone = GraduationCap,
  className,
}: {
  capaUrl: string | null;
  nome: string;
  aspect?: keyof typeof ASPECT_CLASSES;
  icone?: LucideIcon;
  className?: string;
}) {
  if (!capaUrl) {
    return (
      <div
        className={cn(
          "bg-muted flex items-center justify-center rounded-lg",
          ASPECT_CLASSES[aspect],
          className,
        )}
        role="img"
        aria-label={`Sem capa cadastrada para ${nome}`}
      >
        <Icone className="text-muted-foreground size-8" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto de catálogo em bucket público, sem necessidade de otimização do next/image
    <img
      src={capaUrl}
      alt={`Capa de ${nome}`}
      className={cn(ASPECT_CLASSES[aspect], "rounded-lg object-cover", className)}
    />
  );
}
