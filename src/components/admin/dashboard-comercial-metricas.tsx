import { CalendarCheck, GraduationCap, TrendingUp, Users } from "lucide-react";
import type { MetricasComerciais } from "@/lib/relatorios/dashboard-comercial";
import { Card, CardContent } from "@/components/ui/card";

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-muted-foreground text-xs">sem base de comparação</span>;
  const positivo = valor >= 0;
  return (
    <span className={`text-xs font-medium ${positivo ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {positivo ? "▲" : "▼"} {Math.abs(valor)}% vs período anterior
    </span>
  );
}

function MetricaCard({
  icone: Icone,
  valor,
  label,
  variacao,
}: {
  icone: typeof Users;
  valor: string;
  label: string;
  variacao?: number | null;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">{label}</span>
          <Icone className="text-muted-foreground size-4" />
        </div>
        <span className="text-2xl font-semibold tabular-nums">{valor}</span>
        {variacao !== undefined && <Variacao valor={variacao} />}
      </CardContent>
    </Card>
  );
}

export function DashboardComercialMetricas({ metricas }: { metricas: MetricasComerciais }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricaCard icone={Users} valor={String(metricas.novosLeads.valor)} label="Novos leads (30d)" variacao={metricas.novosLeads.variacao} />
      <MetricaCard
        icone={CalendarCheck}
        valor={String(metricas.agendamentosRealizados.valor)}
        label="Agendamentos realizados (30d)"
        variacao={metricas.agendamentosRealizados.variacao}
      />
      <MetricaCard icone={TrendingUp} valor={`${metricas.taxaConversao}%`} label="Taxa de conversão" />
      <MetricaCard
        icone={GraduationCap}
        valor={String(metricas.matriculasMes.valor)}
        label="Matrículas este mês"
        variacao={metricas.matriculasMes.variacao}
      />
    </div>
  );
}
