import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAlertasDia, type AlertaDia } from "@/lib/admin/alertas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BORDA_CLASSES: Record<AlertaDia["cor"], string> = {
  amber: "border-amber-500/30",
  blue: "border-blue-500/30",
  red: "border-red-500/30",
};

const BADGE_CLASSES: Record<AlertaDia["cor"], string> = {
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export async function AlertasDia() {
  const supabase = await createClient();
  const alertas = await getAlertasDia(supabase);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas do dia</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {alertas.length === 0 ? (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            ✓ Nenhuma pendência no momento
          </p>
        ) : (
          alertas.map((alerta) => (
            <Link key={alerta.chave} href={alerta.href}>
              <Card className={`hover:bg-accent/50 transition-colors ${BORDA_CLASSES[alerta.cor]}`}>
                <CardContent className="flex items-center gap-3 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_CLASSES[alerta.cor]}`}
                  >
                    {alerta.quantidade}
                  </span>
                  <span className="flex-1 text-sm">{alerta.titulo}</span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
