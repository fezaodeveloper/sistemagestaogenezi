import { Users, GraduationCap, School } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getNotificacaoResgatesPendentes } from "@/lib/creditos/resgates";
import { getNotificacaoCertificadosPendentes } from "@/lib/certificados/certificados";
import { getNotificacaoMensagensFalha } from "@/lib/mensagens/mensagens";
import { getNotificacaoLeadsNovos } from "@/lib/leads/leads";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import { DashboardBalao } from "@/components/admin/dashboard-balao";
import { Card, CardContent } from "@/components/ui/card";

function StatTile({
  icone: Icone,
  valor,
  label,
}: {
  icone: typeof Users;
  valor: number;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="bg-muted rounded-full p-2">
          <Icone className="text-muted-foreground size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold">{valor}</span>
          <span className="text-muted-foreground text-sm">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const [
    { count: totalAlunos },
    { count: cursosAtivos },
    { count: turmasEmAndamento },
    notificacaoResgates,
    notificacaoCertificados,
    notificacaoMensagens,
    notificacaoLeads,
  ] = await Promise.all([
    supabase.from("alunos").select("*", { count: "exact", head: true }),
    supabase.from("cursos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("turmas").select("*", { count: "exact", head: true }).eq("status", "ativa"),
    getNotificacaoResgatesPendentes(supabase),
    getNotificacaoCertificadosPendentes(supabase),
    getNotificacaoMensagensFalha(supabase),
    getNotificacaoLeadsNovos(supabase),
  ]);

  // Cada domínio (resgates, certificados, mensagens, leads) devolve null
  // quando não há nada pendente — só entra aqui quem tem algo pra mostrar.
  // Adicionar um balão novo é só empilhar mais uma function nesse array,
  // sem mexer em mais nada nesta página.
  const notificacoes: DashboardNotificacao[] = [
    notificacaoResgates,
    notificacaoCertificados,
    notificacaoMensagens,
    notificacaoLeads,
  ].filter((n): n is DashboardNotificacao => n !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel</h1>
        <p className="text-muted-foreground text-sm">Bem-vindo, {user.full_name ?? user.email}.</p>
      </div>

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">Resumo geral</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile icone={Users} valor={totalAlunos ?? 0} label="Alunos" />
          <StatTile icone={GraduationCap} valor={cursosAtivos ?? 0} label="Cursos ativos" />
          <StatTile icone={School} valor={turmasEmAndamento ?? 0} label="Turmas em andamento" />
        </div>
      </div>

      {notificacoes.length > 0 && (
        <div>
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">Pendências</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {notificacoes.map((notificacao) => (
              <DashboardBalao key={notificacao.chave} notificacao={notificacao} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
