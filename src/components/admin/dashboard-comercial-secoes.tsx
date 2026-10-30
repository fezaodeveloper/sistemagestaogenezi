import Link from "next/link";
import { ExternalLink, User } from "lucide-react";
import type { AgendamentoHoje, CampanhaAtiva, RetornoPendenteDashboard } from "@/lib/relatorios/dashboard-comercial";
import { AGENDAMENTO_STATUS_BADGE_CLASS, AGENDAMENTO_STATUS_LABELS, type AgendamentoStatus } from "@/lib/agendamentos/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BASE_URL = "https://sistemagestaogenezi.vercel.app";

function formatarDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

// ===== PARTE 5 — Agenda de hoje =====

export function DashboardComercialAgendaHoje({ agendamentos }: { agendamentos: AgendamentoHoje[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">📅 Agenda de hoje</CardTitle>
        <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/admin/comercial/agendamentos" />}>
          Ver todos
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {agendamentos.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhum agendamento para hoje.</p>
        ) : (
          agendamentos.map((agendamento) => (
            <div key={agendamento.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <span className="w-12 shrink-0 font-semibold tabular-nums">{agendamento.horario}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{agendamento.nome}</p>
                <a
                  href={`https://wa.me/55${agendamento.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground text-xs hover:underline"
                >
                  📱 {agendamento.whatsapp}
                </a>
              </div>
              <Badge className={AGENDAMENTO_STATUS_BADGE_CLASS[agendamento.status as AgendamentoStatus] ?? ""}>
                {AGENDAMENTO_STATUS_LABELS[agendamento.status as AgendamentoStatus] ?? agendamento.status}
              </Badge>
              {agendamento.leadId && (
                <Link href={`/admin/leads/${agendamento.leadId}/editar`} className="text-muted-foreground hover:text-foreground shrink-0" title="Ver lead">
                  <User className="size-4" />
                </Link>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ===== PARTE 6 — Campanhas ativas =====

export function DashboardComercialCampanhas({ campanhas }: { campanhas: CampanhaAtiva[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">🚀 Campanhas ativas</CardTitle>
        <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/admin/comercial/paginas-campanha" />}>
          Ver todas
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {campanhas.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhuma campanha ativa no momento.</p>
        ) : (
          campanhas.map((campanha) => (
            <div key={campanha.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{campanha.titulo}</p>
                <p className="text-muted-foreground text-xs">Criada em {formatarDataHoraBR(campanha.criadaEm)}</p>
              </div>
              <Badge variant="outline">{campanha.leadsCaptados} lead(s)</Badge>
              <a
                href={`${BASE_URL}/campanha/${campanha.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
                title="Ver página pública"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ===== PARTE 7 — Retornos pendentes =====

export function DashboardComercialRetornos({ retornos }: { retornos: RetornoPendenteDashboard[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">⚠️ Retornos pendentes</CardTitle>
        <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/admin/leads?filtro=retornos" />}>
          Ver todos
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {retornos.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhum retorno pendente.</p>
        ) : (
          retornos.map((retorno) => (
            <div key={retorno.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{retorno.nome}</p>
                <p className={retorno.vencido ? "text-xs font-medium text-red-600 dark:text-red-400" : "text-muted-foreground text-xs"}>
                  {formatarDataHoraBR(retorno.proximoContato)} {retorno.vencido ? "— vencido" : ""}
                </p>
              </div>
              {retorno.responsavelNome && <span className="text-muted-foreground shrink-0 text-xs">{retorno.responsavelNome}</span>}
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/leads/${retorno.id}/editar`} />}>
                Abrir lead
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
