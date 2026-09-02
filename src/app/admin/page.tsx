import { Users, GraduationCap, School } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlertasDia } from "@/components/admin/alertas-dia";
import { AtalhosRapidos } from "@/components/admin/atalhos-rapidos";
import { SaudeEscola } from "@/components/admin/saude-escola";
import { DashboardCalendario } from "@/components/admin/dashboard-calendario";
import { PendenciasResumo } from "@/components/admin/pendencias-resumo";
import { DashboardKpisFinanceiros } from "@/components/admin/dashboard-kpis-financeiros";
import { Card, CardContent } from "@/components/ui/card";

function saudacaoPorHorario(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function StatTile({
  icone: Icone,
  valor,
  label,
  cor,
}: {
  icone: typeof Users;
  valor: number | string;
  label: string;
  cor: "blue" | "cyan" | "violet";
}) {
  const corTexto: Record<string, string> = {
    blue: "#2196F3",
    cyan: "#22D3EE",
    violet: "#A78BFA",
  };
  return (
    <Card className={`gz-kpi gz-kpi-${cor}`}>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
            {label}
          </span>
          <Icone className="text-muted-foreground size-4" />
        </div>
        <span className="gz-num text-[27px]" style={{ color: corTexto[cor] }}>
          {valor}
        </span>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");

  const supabase = await createClient();

  const hoje = new Date();
  const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const fimMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

  const [
    { count: totalAlunos },
    { count: cursosAtivos },
    { count: turmasEmAndamento },
    { count: matriculasAtivas },
    { count: parcelasPendentesMes },
    { data: parcelasPagasMesData },
    { data: avulsosMesData },
  ] = await Promise.all([
    supabase.from("alunos").select("*", { count: "exact", head: true }),
    supabase.from("cursos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("turmas").select("*", { count: "exact", head: true }).eq("status", "ativa"),
    supabase.from("matriculas").select("*", { count: "exact", head: true }).eq("status", "ativa"),
    supabase
      .from("parcelas")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente")
      .gte("data_vencimento", inicioMes)
      .lte("data_vencimento", fimMes),
    supabase.from("parcelas").select("valor").eq("status", "pago").gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes),
    supabase.from("pagamentos_avulsos").select("valor").gte("data_pagamento", inicioMes).lte("data_pagamento", fimMes),
  ]);

  const receitaMes =
    ((parcelasPagasMesData ?? []) as { valor: number }[]).reduce((soma, p) => soma + Number(p.valor), 0) +
    ((avulsosMesData ?? []) as { valor: number }[]).reduce((soma, a) => soma + Number(a.valor), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {saudacaoPorHorario()}, {user.full_name ?? user.email}!
        </h1>
        <p className="text-muted-foreground text-sm">Aqui está o panorama da escola hoje.</p>
      </div>

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">Resumo geral</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile icone={Users} valor={totalAlunos ?? 0} label="Alunos" cor="cyan" />
          <StatTile icone={GraduationCap} valor={cursosAtivos ?? 0} label="Cursos ativos" cor="blue" />
          <StatTile icone={School} valor={turmasEmAndamento ?? 0} label="Turmas em andamento" cor="violet" />
        </div>
      </div>

      <DashboardKpisFinanceiros
        matriculasAtivas={matriculasAtivas ?? 0}
        parcelasPendentesMes={parcelasPendentesMes ?? 0}
        receitaMes={receitaMes}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <AlertasDia />
          <PendenciasResumo />
        </div>
        <div className="flex flex-col gap-6">
          <AtalhosRapidos />
          <SaudeEscola />
          <DashboardCalendario />
        </div>
      </div>
    </div>
  );
}
