"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { CronogramaAulaRow, TurmaCronogramaOpcao } from "@/app/admin/cronograma/actions";
import { regenerarCronograma } from "@/app/admin/cronograma/actions";
import { adicionarDias, hojeISO, segundaDaSemana } from "@/lib/datas/util";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TODAS_TURMAS = "todas";

const DIAS_SEMANA_GRADE = [
  { label: "Segunda", offset: 0 },
  { label: "Terça", offset: 1 },
  { label: "Quarta", offset: 2 },
  { label: "Quinta", offset: 3 },
  { label: "Sexta", offset: 4 },
  { label: "Sábado", offset: 5 },
] as const;

function formatDataBR(isoDate: string): string {
  const [, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}`;
}

function RegenerarCronogramaButton({ turmaId }: { turmaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await regenerarCronograma(turmaId);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="ghost" size="icon-sm" disabled={isPending} onClick={handleClick}>
        <RefreshCw className={isPending ? "animate-spin" : undefined} />
      </Button>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

function CelulaCronograma({ aula }: { aula: CronogramaAulaRow | undefined }) {
  if (!aula) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="font-medium">{aula.aulas?.titulo ?? "—"}</span>
      {aula.aulas && (
        <span className="text-muted-foreground">
          Aula {aula.aulas.numero} · Módulo {aula.aulas.modulos?.numero ?? "—"}
          {aula.aulas.modulos ? ` — ${aula.aulas.modulos.titulo}` : ""}
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {aula.eh_feriado && (
          <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            Feriado
          </Badge>
        )}
        {aula.cancelada && (
          <Badge className="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            Cancelada
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CronogramaView({
  turmas,
  cronograma,
  turmaIdSelecionada,
  semanaInicio,
}: {
  turmas: TurmaCronogramaOpcao[];
  cronograma: CronogramaAulaRow[];
  turmaIdSelecionada: string;
  semanaInicio: string;
}) {
  const router = useRouter();

  function construirUrl(overrides: { turmaId?: string; semana?: string }) {
    const params = new URLSearchParams();
    const turmaId = overrides.turmaId ?? turmaIdSelecionada;
    const semana = overrides.semana ?? semanaInicio;
    if (turmaId) params.set("turma_id", turmaId);
    params.set("semana", semana);
    return `/admin/cronograma?${params.toString()}`;
  }

  function handleTurmaChange(valor: string) {
    router.push(construirUrl({ turmaId: valor === TODAS_TURMAS ? "" : valor }));
  }

  const semanaFim = adicionarDias(semanaInicio, 5);
  const turmaItems: Record<string, string> = {
    [TODAS_TURMAS]: "Todas as turmas",
    ...Object.fromEntries(turmas.map((turma) => [turma.id, turma.nome])),
  };

  // Mapa (turma_id -> data_aula -> linha) pra achar rápido o que cai em
  // cada célula da grade (turma x dia da semana).
  const cronogramaPorTurmaEData = new Map<string, Map<string, CronogramaAulaRow>>();
  for (const linha of cronograma) {
    const porData = cronogramaPorTurmaEData.get(linha.turma_id) ?? new Map();
    porData.set(linha.data_aula, linha);
    cronogramaPorTurmaEData.set(linha.turma_id, porData);
  }

  const turmasExibidas = turmaIdSelecionada
    ? turmas.filter((turma) => turma.id === turmaIdSelecionada)
    : turmas;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            items={turmaItems}
            value={turmaIdSelecionada || TODAS_TURMAS}
            onValueChange={(value) => handleTurmaChange(value as string)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(turmaItems).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {turmaItems[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => router.push(construirUrl({ semana: adicionarDias(semanaInicio, -7) }))}
              aria-label="Semana anterior"
            >
              <ChevronLeft />
            </Button>
            <span className="w-40 text-center text-sm font-medium">
              Semana de {formatDataBR(semanaInicio)} a {formatDataBR(semanaFim)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => router.push(construirUrl({ semana: adicionarDias(semanaInicio, 7) }))}
              aria-label="Próxima semana"
            >
              <ChevronRight />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(construirUrl({ semana: segundaDaSemana(hojeISO()) }))}
          >
            Hoje
          </Button>
        </div>
      </div>

      {turmasExibidas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma turma ativa encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turma</TableHead>
                {DIAS_SEMANA_GRADE.map((dia) => (
                  <TableHead key={dia.label}>
                    {dia.label}
                    <div className="text-muted-foreground font-normal">
                      {formatDataBR(adicionarDias(semanaInicio, dia.offset))}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {turmasExibidas.map((turma) => {
                const porData = cronogramaPorTurmaEData.get(turma.id);
                return (
                  <TableRow key={turma.id}>
                    <TableCell className="align-top font-medium">
                      <div className="flex items-center gap-1">
                        <span>{turma.nome}</span>
                        <RegenerarCronogramaButton turmaId={turma.id} />
                      </div>
                    </TableCell>
                    {DIAS_SEMANA_GRADE.map((dia) => {
                      const data = adicionarDias(semanaInicio, dia.offset);
                      const aula = porData?.get(data);
                      return (
                        <TableCell
                          key={dia.label}
                          className={
                            "align-top " +
                            (aula?.eh_feriado ? "bg-amber-500/5" : "")
                          }
                        >
                          <CelulaCronograma aula={aula} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
