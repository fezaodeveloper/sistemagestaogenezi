"use client";

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

export function DashboardGraficos({ dados }: { dados: DashboardGraficosDados }) {
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
                <Tooltip formatter={(valor) => formatMoeda(Number(valor))} />
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
                <Tooltip />
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2">
              {dados.statusMatriculas.map((item) => {
                const totalGeral = dados.statusMatriculas.reduce((soma, atual) => soma + atual.total, 0);
                const percentual = totalGeral > 0 ? Math.round((item.total / totalGeral) * 100) : 0;
                return (
                  <div key={item.status} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: COR_STATUS[item.status] ?? "#94a3b8" }}
                    />
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">
                      — {item.total} ({percentual}%)
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
