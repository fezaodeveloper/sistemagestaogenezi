import type { DadosPortal, DadosPortalMatricula } from "@/app/responsavel/actions";
import { dataComDiaSemana } from "@/lib/datas/util";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIPO_EVENTO_COR, TIPO_EVENTO_LABELS, formatHorario } from "@/lib/responsavel/formatacao";

type ItemAgenda = {
  id: string;
  data: string;
  label: string;
  tipo: "aula" | "feriado" | "evento" | "prova" | "outro";
  horario: string | null;
};

export function SecaoAgenda({
  matricula,
  eventosCalendario,
}: {
  matricula: DadosPortalMatricula;
  eventosCalendario: DadosPortal["eventosCalendario"];
}) {
  const horarioAula = formatHorario(matricula.turma.horarioAula);

  const itensAula: ItemAgenda[] = matricula.proximasAulas.map((aula) => ({
    id: `aula-${aula.aulaId}-${aula.data}`,
    data: aula.data,
    label: `Aula — ${matricula.nomeCurso}`,
    tipo: "aula",
    horario: horarioAula,
  }));

  const itensEvento: ItemAgenda[] = eventosCalendario.map((evento) => ({
    id: evento.id,
    data: evento.dataInicio,
    label: evento.nome,
    tipo: (evento.tipo as ItemAgenda["tipo"]) ?? "outro",
    horario: formatHorario(evento.horarioInicio),
  }));

  const itens = [...itensAula, ...itensEvento].sort((a, b) => a.data.localeCompare(b.data));

  if (itens.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agenda</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Nenhum evento ou aula programada para os próximos 30 dias.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Próximos 30 dias</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${TIPO_EVENTO_COR[item.tipo] ?? ""}`}>{item.label}</span>
              <span className="text-muted-foreground text-xs">{dataComDiaSemana(item.data)}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={`text-xs font-medium ${TIPO_EVENTO_COR[item.tipo] ?? ""}`}>
                {TIPO_EVENTO_LABELS[item.tipo] ?? item.tipo}
              </span>
              {item.horario && <span className="text-muted-foreground text-xs">{item.horario}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
