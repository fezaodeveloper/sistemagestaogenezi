import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAgendaHoje,
  getCampanhasAtivas,
  getFunilConversao,
  getLeadsPorPeriodo,
  getMetricasComerciais,
  getRetornosPendentesDashboard,
} from "@/lib/relatorios/dashboard-comercial";
import { DashboardComercialMetricas } from "@/components/admin/dashboard-comercial-metricas";
import { DashboardComercialFunil } from "@/components/admin/dashboard-comercial-funil";
import { DashboardComercialLeadsGrafico } from "@/components/admin/dashboard-comercial-leads-grafico";
import {
  DashboardComercialAgendaHoje,
  DashboardComercialCampanhas,
  DashboardComercialRetornos,
} from "@/components/admin/dashboard-comercial-secoes";

// TAREFA dashboard 2.6 — tela só de leitura/agregação; createAdminClient (service_role) pedido
// explicitamente na tarefa, sem RLS por linha a respeitar aqui.
export default async function DashboardComercialPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const [metricas, funil, leadsPorPeriodo, agendaHoje, campanhasAtivas, retornosPendentes] = await Promise.all([
    getMetricasComerciais(admin),
    getFunilConversao(admin),
    getLeadsPorPeriodo(admin),
    getAgendaHoje(admin),
    getCampanhasAtivas(admin),
    getRetornosPendentesDashboard(admin),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard Comercial</h1>
        <p className="text-muted-foreground text-sm">Visão geral de leads, agendamentos e campanhas.</p>
      </div>

      <DashboardComercialMetricas metricas={metricas} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardComercialFunil etapas={funil} />
        <DashboardComercialLeadsGrafico dados={leadsPorPeriodo} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardComercialAgendaHoje agendamentos={agendaHoje} />
        <DashboardComercialCampanhas campanhas={campanhasAtivas} />
      </div>

      <DashboardComercialRetornos retornos={retornosPendentes} />
    </div>
  );
}
