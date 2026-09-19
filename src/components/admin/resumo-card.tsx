import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type ResumoCardCor = "green" | "slate" | "red" | "blue" | "amber" | "violet";

// Chip do ícone: fundo translúcido + texto/ícone na cor — legível no tema claro e no escuro.
const COR_ICONE: Record<ResumoCardCor, string> = {
  green: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  slate: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  red: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
};

// Card de resumo (KPI) das telas de listagem. Server Component — sem estado.
export function ResumoCard({
  label,
  valor,
  sublabel,
  icon: Icon,
  cor,
}: {
  label: string;
  valor: ReactNode;
  sublabel?: string;
  icon: LucideIcon;
  cor: ResumoCardCor;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${COR_ICONE[cor]}`}>
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">{label}</span>
          <span className="text-2xl leading-tight font-semibold tabular-nums">{valor}</span>
          {sublabel && <span className="text-muted-foreground text-xs">{sublabel}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
