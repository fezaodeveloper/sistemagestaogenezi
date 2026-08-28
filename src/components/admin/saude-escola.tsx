import { createClient } from "@/lib/supabase/server";
import { calcularSaudeEscola } from "@/lib/admin/saude";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function corPontuacao(pontuacao: number): { texto: string; barra: string; label: string } {
  if (pontuacao < 60) return { texto: "text-red-500", barra: "bg-red-500", label: "Crítico" };
  if (pontuacao <= 80) return { texto: "text-amber-500", barra: "bg-amber-500", label: "Atenção" };
  return { texto: "text-green-500", barra: "bg-green-500", label: "Excelente" };
}

function BarraComponente({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{valor}%</span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${corPontuacao(valor).barra}`} style={{ width: `${valor}%` }} />
      </div>
    </div>
  );
}

export async function SaudeEscola() {
  const supabase = await createClient();
  const saude = await calcularSaudeEscola(supabase);
  const cor = corPontuacao(saude.pontuacao);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saúde da escola</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className={`text-4xl font-bold ${cor.texto}`}>{saude.pontuacao}</span>
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${cor.texto}`}>{cor.label}</span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${cor.barra}`}
                style={{ width: `${saude.pontuacao}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <BarraComponente label="Ocupação das turmas" valor={saude.ocupacao} />
          <BarraComponente label="Alunos em dia com pagamentos" valor={saude.pagamentosEmDia} />
          <BarraComponente label="Frequência média" valor={saude.frequencia} />
          <BarraComponente label="Alunos com nota acima do mínimo" valor={saude.notaAcima} />
        </div>
      </CardContent>
    </Card>
  );
}
