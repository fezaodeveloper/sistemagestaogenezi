import { CalendarClock, GraduationCap, MapPin, UserCog } from "lucide-react";
import type { DadosPortal, DadosPortalMatricula } from "@/app/responsavel/actions";
import { dataComDiaSemana } from "@/lib/datas/util";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_MATRICULA_LABELS, corFrequencia, formatDataBR, formatHorarioTurma } from "@/lib/responsavel/formatacao";

function CardResumo({
  titulo,
  valor,
  valorClassName,
  detalhe,
}: {
  titulo: string;
  valor: string;
  valorClassName?: string;
  detalhe?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-muted-foreground text-xs">{titulo}</span>
        <span className={`text-2xl font-semibold ${valorClassName ?? ""}`}>{valor}</span>
        {detalhe && <span className="text-muted-foreground text-xs">{detalhe}</span>}
      </CardContent>
    </Card>
  );
}

export function SecaoInicio({
  aluno,
  matricula,
}: {
  aluno: DadosPortal["aluno"];
  matricula: DadosPortalMatricula;
}) {
  const percentualFrequencia =
    matricula.frequencia.totalAulas > 0
      ? Math.round((matricula.frequencia.presentes / matricula.frequencia.totalAulas) * 100)
      : null;
  const percentualProgresso =
    matricula.progresso.total > 0 ? Math.round((matricula.progresso.concluidas / matricula.progresso.total) * 100) : null;
  const parcelasPendentes = matricula.parcelas.filter((p) => p.status === "pendente" || p.status === "atrasado").length;
  const proximaAula = matricula.proximasAulas[0] ?? null;

  const horarioTurma = formatHorarioTurma(
    matricula.turma.cadenciaDiasSemana,
    matricula.turma.horarioAula,
    matricula.turma.horarioFim,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardResumo
          titulo="Frequência"
          valor={percentualFrequencia === null ? "—" : `${percentualFrequencia}%`}
          valorClassName={percentualFrequencia === null ? "" : corFrequencia(percentualFrequencia)}
        />
        <CardResumo
          titulo="Progresso"
          valor={percentualProgresso === null ? "—" : `${percentualProgresso}%`}
          detalhe={
            matricula.progresso.total > 0
              ? `${matricula.progresso.concluidas} de ${matricula.progresso.total} aulas`
              : undefined
          }
        />
        <CardResumo
          titulo="Parcelas"
          valor={String(parcelasPendentes)}
          valorClassName={parcelasPendentes > 0 ? "text-amber-500" : ""}
          detalhe={parcelasPendentes > 0 ? "pendentes/vencidas" : "tudo em dia"}
        />
        <CardResumo
          titulo="Próxima aula"
          valor={proximaAula ? formatDataBR(proximaAula.data) : "—"}
          detalhe={proximaAula ? dataComDiaSemana(proximaAula.data) : "Sem data calculada"}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="text-muted-foreground size-4" />
            <span className="font-medium">
              {matricula.nomeCurso} — {matricula.nomeTurma}
            </span>
            <Badge variant="outline">{STATUS_MATRICULA_LABELS[matricula.status] ?? matricula.status}</Badge>
          </div>

          <div className="text-muted-foreground grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <span>Matriculado em {formatDataBR(matricula.data_matricula)}</span>
            <span>Previsão de conclusão: {formatDataBR(matricula.previsaoConclusao)}</span>
            {matricula.turma.professor && (
              <span className="flex items-center gap-1.5">
                <UserCog className="size-3.5" />
                Professor(a): {matricula.turma.professor}
              </span>
            )}
            {horarioTurma && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {horarioTurma}
              </span>
            )}
            {matricula.turma.localSala && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {matricula.turma.localSala}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {!aluno.full_name && (
        <p className="text-muted-foreground text-center text-sm">Dados do aluno incompletos.</p>
      )}
    </div>
  );
}
