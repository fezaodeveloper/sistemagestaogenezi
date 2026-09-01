"use client";

import { useEffect, useState } from "react";
import { Clock, Eye, EyeOff, TrendingUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "genezi-financeiro-visivel";
const VALOR_OCULTO = "R$ ••••";

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Contagens simples (não são valores em R$) — nunca ocultadas pelo toggle.
// O admin já vê esses números em outros lugares do sistema (lista de
// matrículas, financeiro), então escondê-los não protege nada.
function ContagemStatTile({
  icone: Icone,
  valor,
  label,
  cor,
}: {
  icone: typeof UserCheck;
  valor: number;
  label: string;
  cor: "green" | "amber";
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
        <span className="gz-num text-[27px]" style={{ color: corTexto[cor] }}>
          {valor}
        </span>
      </CardContent>
    </Card>
  );
}

// Único card com valor monetário — o único afetado pelo toggle de olho.
function ValorMonetarioStatTile({ valor, label, visivel }: { valor: number; label: string; visivel: boolean }) {
  return (
    <Card className="gz-kpi gz-kpi-green">
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
            {label}
          </span>
          <TrendingUp className="text-muted-foreground size-4" />
        </div>
        <span className="gz-num text-[20px]" style={{ color: "#2DD4A0" }}>
          {visivel ? formatValor(valor) : VALOR_OCULTO}
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
        <ContagemStatTile icone={UserCheck} valor={matriculasAtivas} label="Matrículas ativas" cor="green" />
        <ContagemStatTile icone={Clock} valor={parcelasPendentesMes} label="Parcelas pendentes (mês)" cor="amber" />
        <ValorMonetarioStatTile valor={receitaMes} label="Receita do mês" visivel={visivel} />
      </div>
    </div>
  );
}
