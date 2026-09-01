import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getPendencias } from "@/app/admin/pendencias/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Reconsulta getPendencias() (não recebe o count via prop): layout.tsx e
// esta page são segmentos irmãos na árvore do App Router, não há como
// layout repassar dados computados pra page via props. requireRole(),
// chamado dentro de getPendencias(), usa cache() do React — só a checagem
// de sessão é deduplicada entre as duas chamadas na mesma request, as
// queries de pendências em si rodam de novo aqui (mesmo padrão já aceito
// em AlertasDia/SaudeEscola, que também fazem suas próprias queries).
export async function PendenciasResumo() {
  const pendencias = await getPendencias();
  const total = pendencias.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendências</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            ✓ Nenhuma pendência
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-5" />
              </div>
              <span className="text-sm">
                {total} pendência{total > 1 ? "s" : ""} ativa{total > 1 ? "s" : ""}
              </span>
            </div>
            <Button
              render={<Link href="/admin/pendencias" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Ver todas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
