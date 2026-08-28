import { Users, GraduationCap, School, UserCheck, Clock, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getNotificacaoResgatesPendentes } from "@/lib/creditos/resgates";
import { getNotificacaoCertificadosPendentes } from "@/lib/certificados/certificados";
import { getNotificacaoMensagensFalha } from "@/lib/mensagens/mensagens";
import { getNotificacaoLeadsNovos } from "@/lib/leads/leads";
import { getNotificacaoConversasNaoLidas } from "@/lib/chat/chat";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import { DashboardBalao } from "@/components/admin/dashboard-balao";
import { AlertasDia } from "@/components/admin/alertas-dia";
import { AtalhosRapidos } from "@/components/admin/atalhos-rapidos";
import { SaudeEscola } from "@/components/admin/saude-escola";
import { BuscaGlobal } from "@/components/admin/busca-global";
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
  compacto = false,
}: {
  icone: typeof Users;
  valor: number | string;
  label: string;
  cor: "blue" | "cyan" | "green" | "amber" | "red" | "violet";
  compacto?: boolean;
}) {
  const corTexto: Record<string, string> = {
    blue: "#2196F3",
    cyan: "#22D3EE",
    green: "#2DD4A0",
    amber: "#FFB020",
    red: "#FF5A5F",
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
        <span
          className={`gz-num ${compacto ? "text-[20px]" : "text-[27px]"}`}
          style={{ color: corTexto[cor] }}
        >
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
    notificacaoResgates,
    notificacaoCertificados,
    notificacaoMensagens,
    notificacaoLeads,
    notificacaoConversas,
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
    getNotificacaoResgatesPendentes(supabase),
    getNotificacaoCertificadosPendentes(supabase),
    getNotificacaoMensagensFalha(supabase),
    getNotificacaoLeadsNovos(supabase),
    getNotificacaoConversasNaoLidas(supabase),
  ]);

  const receitaMes =
    ((parcelasPagasMesData ?? []) as { valor: number }[]).reduce((soma, p) => soma + Number(p.valor), 0) +
    ((avulsosMesData ?? []) as { valor: number }[]).reduce((soma, a) => soma + Number(a.valor), 0);

  // Cada domínio (resgates, certificados, mensagens, leads, chat) devolve
  // null quando não há nada pendente — só entra aqui quem tem algo pra
  // mostrar. Adicionar um balão novo é só empilhar mais uma function
  // nesse array, sem mexer em mais nada nesta página.
  const notificacoes: DashboardNotificacao[] = [
    notificacaoResgates,
    notificacaoCertificados,
    notificacaoMensagens,
    notificacaoLeads,
    notificacaoConversas,
  ].filter((n): n is DashboardNotificacao => n !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {saudacaoPorHorario()}, {user.full_name ?? user.email}!
        </h1>
        <p className="text-muted-foreground text-sm">Aqui está o panorama da escola hoje.</p>
      </div>

      <BuscaGlobal />

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">Resumo geral</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile icone={Users} valor={totalAlunos ?? 0} label="Alunos" cor="cyan" />
          <StatTile icone={GraduationCap} valor={cursosAtivos ?? 0} label="Cursos ativos" cor="blue" />
          <StatTile icone={School} valor={turmasEmAndamento ?? 0} label="Turmas em andamento" cor="violet" />
          <StatTile icone={UserCheck} valor={matriculasAtivas ?? 0} label="Matrículas ativas" cor="green" />
          <StatTile icone={Clock} valor={parcelasPendentesMes ?? 0} label="Parcelas pendentes (mês)" cor="amber" />
          <StatTile
            icone={TrendingUp}
            valor={receitaMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            label="Receita do mês"
            cor="green"
            compacto
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <AlertasDia />
          <AtalhosRapidos />
        </div>
        <div className="flex flex-col gap-6">
          <SaudeEscola />
          {notificacoes.length > 0 && (
            <div>
              <h2 className="text-muted-foreground mb-3 text-sm font-medium">Pendências</h2>
              <div className="grid grid-cols-1 gap-4">
                {notificacoes.map((notificacao) => (
                  <DashboardBalao key={notificacao.chave} notificacao={notificacao} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
