import type { CSSProperties } from "react";
import { Users, GraduationCap, School } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlertasDia } from "@/components/admin/alertas-dia";
import { AtalhosRapidos } from "@/components/admin/atalhos-rapidos";
import { SaudeEscola } from "@/components/admin/saude-escola";
import { DashboardCalendario } from "@/components/admin/dashboard-calendario";
import { PendenciasResumo } from "@/components/admin/pendencias-resumo";
import { DashboardKpisFinanceiros } from "@/components/admin/dashboard-kpis-financeiros";
import { DashboardGraficos } from "@/components/admin/dashboard-graficos";
import { getDadosGraficosDashboard } from "@/lib/relatorios/dashboard-graficos";
import { Badge } from "@/components/ui/badge";
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
  detalhes,
}: {
  icone: typeof Users;
  valor: number | string;
  label: string;
  cor: "blue" | "cyan" | "violet";
  // Quebra opcional do valor principal (ex.: alunos ativos por status) — exibida como badges
  // dentro do mesmo card, sem criar uma nova célula no grid de 3 colunas (loading.tsx tem um
  // skeleton genérico de 3 cards, então evitar mudar a quantidade de cards no grid real).
  detalhes?: { label: string; valor: number }[];
}) {
  const corTexto: Record<string, string> = {
    blue: "#2196F3",
    cyan: "#22D3EE",
    violet: "#A78BFA",
  };
  return (
    // --card-spacing controla o padding do Card inteiro (ver src/components/ui/card.tsx) — setar
    // pra 1.5rem (p-6 pedido) é mais confiável que sobrescrever px-4/py-4 via className, que
    // brigaria com o valor herdado da variável CSS em vez de substituí-lo de fato.
    <Card className={`gz-kpi gz-kpi-${cor}`} style={{ "--card-spacing": "1.5rem" } as CSSProperties}>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
            {label}
          </span>
          <Icone className="text-muted-foreground size-4" />
        </div>
        <span className="gz-num text-[27px]" style={{ color: corTexto[cor] }}>
          {valor}
        </span>
        {detalhes && detalhes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {detalhes.map((d) => (
              <Badge key={d.label} variant="outline" className="text-[11px]">
                {d.label}: {d.valor}
              </Badge>
            ))}
          </div>
        )}
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
    { count: totalAtivos },
    { count: totalInativos },
    { count: totalTrancados },
    { count: totalFormados },
    { count: cursosAtivos },
    { count: turmasEmAndamento },
    { count: matriculasAtivas },
    { count: parcelasPendentesMes },
    { data: parcelasPagasMesData },
    { data: avulsosMesData },
    graficos,
  ] = await Promise.all([
    supabase.from("alunos").select("*", { count: "exact", head: true }).eq("status_aluno", "ativo"),
    supabase.from("alunos").select("*", { count: "exact", head: true }).eq("status_aluno", "inativo"),
    supabase.from("alunos").select("*", { count: "exact", head: true }).eq("status_aluno", "trancado"),
    supabase.from("alunos").select("*", { count: "exact", head: true }).eq("status_aluno", "formado"),
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
    getDadosGraficosDashboard(supabase),
  ]);

  // Mantida como soma dos 4 status — qualquer lógica existente que espere o total geral de
  // alunos (sem distinção de status_aluno) continua recebendo o mesmo número de antes.
  const totalAlunos = (totalAtivos ?? 0) + (totalInativos ?? 0) + (totalTrancados ?? 0) + (totalFormados ?? 0);

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
          <StatTile
            icone={Users}
            valor={totalAtivos ?? 0}
            label="Alunos Ativos"
            cor="cyan"
            detalhes={[
              { label: "Inativos", valor: totalInativos ?? 0 },
              { label: "Trancados", valor: totalTrancados ?? 0 },
              { label: "Formados", valor: totalFormados ?? 0 },
              { label: "Total", valor: totalAlunos },
            ]}
          />
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

      <DashboardGraficos dados={graficos} />
    </div>
  );
}
