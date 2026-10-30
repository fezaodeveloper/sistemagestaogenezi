"use client";

// "use client": toggle de período (useState) com tooltip ao hover — os 3 conjuntos de dados já
// vêm prontos do Server Component (LeadsPorPeriodo), nenhum fetch acontece aqui.

import { useState } from "react";
import type { LeadsPorDiaPonto, LeadsPorPeriodo } from "@/lib/relatorios/dashboard-comercial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PeriodoId = "30" | "90" | "ano";
const PERIODO_LABELS: Record<PeriodoId, string> = { "30": "30 dias", "90": "90 dias", ano: "Este ano" };

function formatarDiaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function DashboardComercialLeadsGrafico({ dados }: { dados: LeadsPorPeriodo }) {
  const [periodo, setPeriodo] = useState<PeriodoId>("30");
  const [hover, setHover] = useState<LeadsPorDiaPonto | null>(null);

  const pontos = periodo === "30" ? dados.dias30 : periodo === "90" ? dados.dias90 : dados.anoAtual;
  const maior = Math.max(1, ...pontos.map((p) => p.total));
  // Mostra só alguns labels no eixo X pra não poluir — ~8 rótulos, espaçados.
  const passoLabel = Math.max(1, Math.ceil(pontos.length / 8));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">Leads por período</CardTitle>
        <div className="flex items-center gap-1 rounded-md border p-0.5" role="group" aria-label="Período">
          {(Object.keys(PERIODO_LABELS) as PeriodoId[]).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={periodo === id ? "secondary" : "ghost"}
              aria-pressed={periodo === id}
              onClick={() => setPeriodo(id)}
            >
              {PERIODO_LABELS[id]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {pontos.every((p) => p.total === 0) ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Nenhum lead criado nesse período.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative flex h-40 items-end gap-px" onMouseLeave={() => setHover(null)}>
              {pontos.map((ponto) => (
                <div
                  key={ponto.data}
                  className="group relative flex-1"
                  style={{ height: "100%" }}
                  onMouseEnter={() => setHover(ponto)}
                >
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm bg-cyan-500/70 transition-colors group-hover:bg-cyan-400"
                    style={{ height: `${Math.max(2, (ponto.total / maior) * 100)}%` }}
                  />
                </div>
              ))}
              {hover && (
                <div className="bg-popover text-popover-foreground pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-md">
                  {formatarDiaCurto(hover.data)} — {hover.total} lead{hover.total === 1 ? "" : "s"}
                </div>
              )}
            </div>
            <div className="text-muted-foreground flex text-[10px]">
              {pontos.map((ponto, i) => (
                <span key={ponto.data} className="flex-1 text-center">
                  {i % passoLabel === 0 ? formatarDiaCurto(ponto.data) : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
