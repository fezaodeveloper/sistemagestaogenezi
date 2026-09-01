"use client";

import { useEffect, useState } from "react";
import { Clock, Eye, EyeOff, TrendingUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "genezi-financeiro-visivel";
const VALOR_OCULTO = "••••";

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinanceiroStatTile({
  icone: Icone,
  valor,
  label,
  cor,
  visivel,
  compacto = false,
}: {
  icone: typeof UserCheck;
  valor: number | string;
  label: string;
  cor: "green" | "amber";
  visivel: boolean;
  compacto?: boolean;
}) {
  const corTexto: Record<string, string> = {
    green: "#2DD4A0",
    amber: "#FFB020",
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
          {visivel ? valor : VALOR_OCULTO}
        </span>
      </CardContent>
    </Card>
  );
}

export function DashboardKpisFinanceiros({
  matriculasAtivas,
  parcelasPendentesMes,
  receitaMes,
}: {
  matriculasAtivas: number;
  parcelasPendentesMes: number;
  receitaMes: number;
}) {
  const [visivel, setVisivel] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Leitura de localStorage tem que ficar num efeito pós-montagem, não num
  // inicializador de useState — mesmo motivo do STORAGE_KEY em
  // admin-nav-groups.tsx (evita hydration mismatch entre server e client).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo !== null) setVisivel(salvo === "true");
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(visivel));
    } catch {}
  }, [visivel, hydrated]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-muted-foreground text-sm font-medium">Financeiro</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setVisivel((atual) => !atual)}>
          {visivel ? <Eye /> : <EyeOff />}
          {visivel ? "Ocultar valores" : "Mostrar valores"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceiroStatTile
          icone={UserCheck}
          valor={matriculasAtivas}
          label="Matrículas ativas"
          cor="green"
          visivel={visivel}
        />
        <FinanceiroStatTile
          icone={Clock}
          valor={parcelasPendentesMes}
          label="Parcelas pendentes (mês)"
          cor="amber"
          visivel={visivel}
        />
        <FinanceiroStatTile
          icone={TrendingUp}
          valor={formatValor(receitaMes)}
          label="Receita do mês"
          cor="green"
          compacto
          visivel={visivel}
        />
      </div>
    </div>
  );
}
