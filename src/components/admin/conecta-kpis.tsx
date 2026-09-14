import { Briefcase, Building2, CreditCard, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { KpisConecta } from "@/lib/conecta/schema";

const COR_TEXTO: Record<string, string> = {
  green: "#2DD4A0",
  blue: "#2196F3",
  amber: "#FFB020",
  violet: "#A78BFA",
};

// Mesmo padrão gz-kpi de dashboard-kpis-financeiros.tsx — Server Component
// aqui (sem toggle nem estado nenhum, não precisa de "use client").
function KpiTile({
  icone: Icone,
  valor,
  label,
  cor,
}: {
  icone: typeof Building2;
  valor: number;
  label: string;
  cor: "green" | "blue" | "amber" | "violet";
}) {
  return (
    <Card className={`gz-kpi gz-kpi-${cor}`}>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">{label}</span>
          <Icone className="text-muted-foreground size-4" />
        </div>
        <span className="gz-num text-[27px]" style={{ color: COR_TEXTO[cor] }}>
          {valor}
        </span>
      </CardContent>
    </Card>
  );
}

export function ConectaKpis({ kpis }: { kpis: KpisConecta }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile icone={Building2} valor={kpis.empresasAtivas} label="🏢 Empresas ativas" cor="green" />
      <KpiTile icone={Briefcase} valor={kpis.vagasAtivas} label="💼 Vagas abertas" cor="blue" />
      <KpiTile icone={Users} valor={kpis.candidatosVisiveis} label="👥 Candidatos visíveis" cor="amber" />
      <KpiTile icone={CreditCard} valor={kpis.assinantesAtivos} label="💳 Assinantes ativos" cor="violet" />
    </div>
  );
}
