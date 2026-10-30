import type { FunilEtapa } from "@/lib/relatorios/dashboard-comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Barras horizontais com divs (sem lib de gráfico, pedido explícito) — largura proporcional ao
// maior valor do funil (não ao total), senão a primeira coluna sempre ficaria 100% e as outras
// quase murchas demais pra comparar visualmente.
export function DashboardComercialFunil({ etapas }: { etapas: FunilEtapa[] }) {
  const maior = Math.max(1, ...etapas.map((e) => e.total));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {etapas.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhum lead cadastrado ainda.</p>
        ) : (
          etapas.map((etapa) => (
            <div key={etapa.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{etapa.nome}</span>
                <span className="text-muted-foreground tabular-nums">
                  {etapa.total} ({etapa.percentual}%)
                </span>
              </div>
              <div className="bg-muted h-6 w-full overflow-hidden rounded-md">
                <div
                  className="flex h-full items-center rounded-md transition-all"
                  style={{ width: `${Math.max(2, (etapa.total / maior) * 100)}%`, backgroundColor: etapa.cor }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
