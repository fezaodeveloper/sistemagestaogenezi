"use client";

import type { CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardGraficosDados } from "@/lib/relatorios/dashboard-graficos";

function formatMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// "trancada" não existe no enum real de matriculas.status (ver comentário em
// src/lib/relatorios/dashboard-graficos.ts) — a cor âmbar pedida pra
// "trancada" foi aplicada em "inativa", o status real mais próximo (que já
// inclui o alias legado "transferida").
const COR_STATUS: Record<string, string> = {
  ativa: "#22c55e",
  concluida: "#06b6d4",
  cancelada: "#ef4444",
  inativa: "#f59e0b",
};

const MES_COMPLETO: Record<string, string> = {
  Jan: "Janeiro",
  Fev: "Fevereiro",
  Mar: "Março",
  Abr: "Abril",
  Mai: "Maio",
  Jun: "Junho",
  Jul: "Julho",
  Ago: "Agosto",
  Set: "Setembro",
  Out: "Outubro",
  Nov: "Novembro",
  Dez: "Dezembro",
};

// Estilo fixo (não segue dark/light do tema) — pedido explícito: fundo
// branco, texto escuro, borda sutil, independente do tema do dashboard.
const tooltipBoxStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#1e293b",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};

type PayloadItem = { value?: number | string; payload?: Record<string, unknown> };

function TooltipReceita({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const valor = Number(payload[0]?.value ?? 0);
  return (
    <div style={tooltipBoxStyle}>
      <p className="text-sm font-semibold">{MES_COMPLETO[label ?? ""] ?? label}</p>
      <p className="text-sm">{formatMoeda(valor)}</p>
    </div>
  );
}

function TooltipMatriculas({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const valor = Number(payload[0]?.value ?? 0);
  return (
    <div style={tooltipBoxStyle}>
      <p className="text-sm font-semibold">{MES_COMPLETO[label ?? ""] ?? label}</p>
      <p className="text-sm">
        {valor} matrícula{valor === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function TooltipStatusMatriculas({ active, payload, totalGeral }: { active?: boolean; payload?: PayloadItem[]; totalGeral: number }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as { label?: string; total?: number } | undefined;
  if (!item) return null;
  const total = item.total ?? 0;
  const percentual = totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0;
  return (
    <div style={tooltipBoxStyle}>
      <p className="text-sm font-semibold">{item.label}</p>
      <p className="text-sm">Quantidade: {total} alunos</p>
      <p className="text-sm">Percentual: {percentual}%</p>
    </div>
  );
}

export function DashboardGraficos({ dados }: { dados: DashboardGraficosDados }) {
  const totalGeral = dados.statusMatriculas.reduce((soma, atual) => soma + atual.total, 0);

  return (
    <div>
      <h2 className="text-muted-foreground mb-3 text-sm font-medium">Gráficos</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Receita dos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.receitaMensal}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} width={70} tickFormatter={(valor: number) => formatMoeda(valor)} />
                <Tooltip content={<TooltipReceita />} />
                <Bar dataKey="valor" name="Receita" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Novas matrículas por mês</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.novasMatriculasPorMes}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} width={30} allowDecimals={false} />
                <Tooltip content={<TooltipMatriculas />} />
                <Line type="monotone" dataKey="total" name="Matrículas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status das matrículas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <div className="h-64 w-full max-w-xs">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dados.statusMatriculas} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={90}>
                    {dados.statusMatriculas.map((item) => (
                      <Cell key={item.status} fill={COR_STATUS[item.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipStatusMatriculas totalGeral={totalGeral} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2">
              {dados.statusMatriculas.map((item) => {
                const percentual = totalGeral > 0 ? Math.round((item.total / totalGeral) * 100) : 0;
                return (
                  <div key={item.status} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: COR_STATUS[item.status] ?? "#94a3b8" }}
                    />
                    <span>
                      {item.label} — {item.total} ({percentual}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
