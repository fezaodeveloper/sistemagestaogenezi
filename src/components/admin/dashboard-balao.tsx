import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import { Card, CardContent } from "@/components/ui/card";

// Genérico de propósito — não sabe nada sobre resgates, certificados ou
// mensagens, só sabe renderizar o contrato DashboardNotificacao.
export function DashboardBalao({ notificacao }: { notificacao: DashboardNotificacao }) {
  const Icone = notificacao.icone;

  return (
    <Link href={notificacao.href}>
      <Card className="hover:bg-accent/50 border-amber-500/30 transition-colors">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="rounded-full bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
            <Icone className="size-5" />
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-2xl font-semibold">{notificacao.quantidade}</span>
            <span className="text-muted-foreground text-sm">{notificacao.titulo}</span>
          </div>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
