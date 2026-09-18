"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { moverLeadKanban } from "@/app/admin/leads/actions";
import {
  KANBAN_COLUNAS,
  KANBAN_COLUNA_COR_CLASS,
  KANBAN_COLUNA_LABELS,
  TEMPERATURA_BADGE_CLASS,
  TEMPERATURA_LABELS,
  campanhaBadgeClass,
  type KanbanColuna,
} from "@/lib/leads/schema";
import type { LeadComCurso } from "@/lib/leads/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadDetalhesDrawer } from "@/components/admin/lead-detalhes-drawer";

function formatarDataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

function diasDesdeCadastro(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function LeadCard({ lead, onMudou }: { lead: LeadComCurso; onMudou: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [drawerAberto, setDrawerAberto] = useState(false);
  const proximaAcaoFormatada = formatarDataCurta(lead.proxima_acao);
  const vencida =
    !!lead.proxima_acao &&
    lead.proxima_acao < hojeISO() &&
    lead.kanban_coluna !== "matriculado" &&
    lead.kanban_coluna !== "perdido";
  const whatsappDigitos = lead.telefone.replace(/\D/g, "");

  function moverPara(coluna: string | null) {
    if (!coluna) return;
    startTransition(async () => {
      await moverLeadKanban(lead.id, coluna);
      onMudou();
    });
  }

  return (
    <>
      <Card className={vencida ? "border-amber-500/60 bg-amber-500/5" : undefined}>
        <CardContent className="flex flex-col gap-2 p-3">
          <p className="text-sm font-medium">{lead.nome}</p>
          <a
            href={`https://wa.me/55${whatsappDigitos}`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-muted-foreground hover:text-foreground w-fit text-xs hover:underline"
          >
            📱 {lead.telefone}
          </a>

          <div className="flex flex-wrap items-center gap-1.5">
            {lead.temperatura && (
              <Badge className={TEMPERATURA_BADGE_CLASS[lead.temperatura]}>
                {TEMPERATURA_LABELS[lead.temperatura]}
              </Badge>
            )}
            {lead.campanha_origem && (
              <Badge className={`max-w-full ${campanhaBadgeClass(lead.campanha_origem)}`} title={`Campanha: ${lead.campanha_origem}`}>
                <span className="truncate">📣 {lead.campanha_origem}</span>
              </Badge>
            )}
            {proximaAcaoFormatada && (
              <Badge
                variant="outline"
                className={vencida ? "border-amber-500 text-amber-700 dark:text-amber-400" : undefined}
              >
                📅 {proximaAcaoFormatada}
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground text-xs">
            {diasDesdeCadastro(lead.created_at)} dia(s) desde o cadastro
          </p>

          <Button type="button" size="sm" variant="outline" onClick={() => setDrawerAberto(true)}>
            Ver detalhes
          </Button>

          <Select value={lead.kanban_coluna} onValueChange={moverPara} disabled={isPending}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Mover para..." />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_COLUNAS.map((coluna) => (
                <SelectItem key={coluna} value={coluna}>
                  {KANBAN_COLUNA_LABELS[coluna]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <LeadDetalhesDrawer lead={lead} open={drawerAberto} onOpenChange={setDrawerAberto} onMudou={onMudou} />
    </>
  );
}

// Sem @dnd-kit instalado (verificado em package.json) — "mover" é feito pelo
// Select em cada card, não drag and drop de verdade (fallback previsto na
// própria tarefa).
export function LeadsKanbanView({ leads }: { leads: LeadComCurso[] }) {
  const router = useRouter();

  function handleMudou() {
    router.refresh();
  }

  const porColuna = useMemo(() => {
    const grupos = Object.fromEntries(KANBAN_COLUNAS.map((c) => [c, [] as LeadComCurso[]])) as Record<
      KanbanColuna,
      LeadComCurso[]
    >;
    for (const lead of leads) {
      grupos[lead.kanban_coluna]?.push(lead);
    }
    return grupos;
  }, [leads]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {KANBAN_COLUNAS.map((coluna) => (
        <div key={coluna} className="flex w-72 shrink-0 flex-col gap-3">
          <div className={`flex items-center justify-between rounded-md px-3 py-2 ${KANBAN_COLUNA_COR_CLASS[coluna]}`}>
            <span className="text-sm font-semibold">{KANBAN_COLUNA_LABELS[coluna]}</span>
            <Badge variant="outline" className="bg-background/60">
              {porColuna[coluna].length}
            </Badge>
          </div>

          {coluna === "novo" && (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/leads/novo" />}>
              <Plus />
              Adicionar lead
            </Button>
          )}

          <div className="flex flex-col gap-2">
            {porColuna[coluna].length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">Nenhum lead aqui.</p>
            ) : (
              porColuna[coluna].map((lead) => <LeadCard key={lead.id} lead={lead} onMudou={handleMudou} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
