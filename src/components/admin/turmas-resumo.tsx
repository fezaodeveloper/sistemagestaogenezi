import { DoorClosed, Users, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ResumoCard } from "@/components/admin/resumo-card";

export type TurmaResumoLinha = {
  horario_aula: string | null;
  vagas_total: number;
  vagas_ocupadas: number;
};

const SEM_HORARIO = "Sem horário";

// "08:00:00" (coluna time) -> "08:00".
function formatarHorario(horario: string | null): string {
  return horario ? horario.slice(0, 5) : SEM_HORARIO;
}

// Cards de resumo + gráfico de barras "alunos por horário" do topo de /admin/turmas.
// Server Component: barras são divs com largura proporcional, sem biblioteca de gráfico.
export function TurmasResumo({ turmas }: { turmas: TurmaResumoLinha[] }) {
  const vagasOcupadas = turmas.reduce((soma, turma) => soma + turma.vagas_ocupadas, 0);
  const vagasDisponiveis = turmas.reduce((soma, turma) => soma + Math.max(0, turma.vagas_total - turma.vagas_ocupadas), 0);
  const turmasLotadas = turmas.filter((turma) => turma.vagas_total > 0 && turma.vagas_ocupadas >= turma.vagas_total).length;

  const alunosPorHorario = new Map<string, number>();
  for (const turma of turmas) {
    const chave = formatarHorario(turma.horario_aula);
    alunosPorHorario.set(chave, (alunosPorHorario.get(chave) ?? 0) + turma.vagas_ocupadas);
  }
  // Horários em ordem cronológica; "Sem horário" sempre por último.
  const barras = [...alunosPorHorario.entries()].sort(([a], [b]) => {
    if (a === SEM_HORARIO) return 1;
    if (b === SEM_HORARIO) return -1;
    return a.localeCompare(b);
  });
  const maximo = Math.max(1, ...barras.map(([, total]) => total));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ResumoCard label="Vagas ocupadas" valor={vagasOcupadas} sublabel="turmas planejadas e ativas" icon={Users} cor="blue" />
        <ResumoCard label="Vagas disponíveis" valor={vagasDisponiveis} sublabel="turmas planejadas e ativas" icon={UserPlus} cor="green" />
        <ResumoCard label="Turmas lotadas" valor={turmasLotadas} sublabel="vagas ocupadas ≥ vagas" icon={DoorClosed} cor="amber" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-sm font-medium">Alunos por horário</p>
          {barras.length === 0 || vagasOcupadas === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum aluno matriculado em turmas planejadas ou ativas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {barras.map(([horario, total]) => (
                <li key={horario} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-24 shrink-0 tabular-nums">{horario}</span>
                  <div className="bg-muted h-5 flex-1 overflow-hidden rounded-sm">
                    <div
                      className="h-full rounded-sm bg-blue-500"
                      style={{ width: `${(total / maximo) * 100}%` }}
                      role="img"
                      aria-label={`${horario}: ${total} aluno(s)`}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-medium tabular-nums">{total}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
