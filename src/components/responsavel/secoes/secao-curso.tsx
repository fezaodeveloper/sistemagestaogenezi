import { Check } from "lucide-react";
import type { DadosPortalMatricula } from "@/app/responsavel/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function statusModulo(aulas: DadosPortalMatricula["modulos"][number]["aulas"]): {
  label: string;
  cor: string;
  percentual: number;
} {
  if (aulas.length === 0) return { label: "Sem aulas", cor: "bg-muted text-muted-foreground", percentual: 0 };
  const concluidas = aulas.filter((a) => a.concluida).length;
  const percentual = Math.round((concluidas / aulas.length) * 100);
  if (concluidas === aulas.length) {
    return { label: "Concluído", cor: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400", percentual };
  }
  if (concluidas === 0) {
    return { label: "Não iniciado", cor: "bg-muted text-muted-foreground", percentual };
  }
  return { label: `Em andamento · ${percentual}%`, cor: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400", percentual };
}

export function SecaoCurso({ matricula }: { matricula: DadosPortalMatricula }) {
  if (matricula.modulos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Curso</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Conteúdo do curso ainda não disponível.
        </CardContent>
      </Card>
    );
  }

  const percentualGeral =
    matricula.progresso.total > 0 ? Math.round((matricula.progresso.concluidas / matricula.progresso.total) * 100) : 0;

  const proximaAula = matricula.modulos.flatMap((m) => m.aulas).find((a) => !a.concluida);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{matricula.nomeCurso}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {matricula.cargaHorariaHoras && (
            <span className="text-muted-foreground text-sm">Carga horária: {matricula.cargaHorariaHoras}h</span>
          )}
          <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
            <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${percentualGeral}%` }} />
          </div>
          <span className="text-muted-foreground text-sm">
            {matricula.progresso.concluidas} de {matricula.progresso.total} aulas concluídas · {percentualGeral}%
          </span>
          {proximaAula && (
            <p className="text-sm">
              <span className="text-muted-foreground">Próxima etapa: </span>
              <span className="font-medium">{proximaAula.titulo}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {matricula.modulos.map((modulo) => {
          const status = statusModulo(modulo.aulas);
          return (
            <Card key={modulo.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  {modulo.numero}. {modulo.titulo}
                </CardTitle>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cor}`}>{status.label}</span>
              </CardHeader>
              {modulo.aulas.length > 0 && (
                <CardContent className="flex flex-col gap-1.5">
                  {modulo.aulas.map((aula) => (
                    <div key={aula.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                          aula.concluida ? "bg-green-500/20 text-green-500" : "bg-muted text-transparent"
                        }`}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className={aula.concluida ? "" : "text-muted-foreground"}>{aula.titulo}</span>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
