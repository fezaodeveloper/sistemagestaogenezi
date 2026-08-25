"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { deleteEvento, getEventos, sincronizarFeriadosAction } from "@/app/admin/calendario/actions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ABRANGENCIA_LABELS,
  EVENTO_TIPO_BADGE_CLASS,
  EVENTO_TIPO_LABELS,
  TIPO_FERIADO_LABELS,
  type EventoCalendarioComRelacoes,
} from "@/lib/calendario/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Limite prático pra nunca deixar um evento com data_fim absurdamente
// distante (erro de digitação, por exemplo) travar o loop de expansão
// dia-a-dia abaixo — bem acima de qualquer evento acadêmico real.
const LIMITE_DIAS_EVENTO = 366;

function toISODate(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Soma 1 dia a uma data "yyyy-mm-dd" sem passar por `new Date(iso)` (que o
// JS interpreta como UTC meia-noite) — monta a data local a partir dos
// componentes, mesmo padrão de formatDataBR usado no resto do projeto.
function proximoDiaISO(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return toISODate(new Date(ano, mes - 1, dia + 1));
}

function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatHorario(inicio: string | null, fim: string | null): string {
  const inicioFmt = inicio?.slice(0, 5);
  const fimFmt = fim?.slice(0, 5);
  if (!inicioFmt && !fimFmt) return "—";
  if (inicioFmt && fimFmt) return `${inicioFmt} - ${fimFmt}`;
  return inicioFmt ?? fimFmt ?? "—";
}

type DiaGrade = { data: Date; noMes: boolean };

// Grade de semanas completas (dom-sáb) cobrindo o mês, com dias de
// preenchimento do mês anterior/seguinte pra fechar a primeira/última linha.
function gerarDiasGrade(ano: number, mes: number): DiaGrade[] {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  const diaSemanaInicio = primeiroDia.getDay();

  const dias: DiaGrade[] = [];
  for (let i = diaSemanaInicio; i > 0; i--) {
    dias.push({ data: new Date(ano, mes - 1, 1 - i), noMes: false });
  }
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    dias.push({ data: new Date(ano, mes - 1, dia), noMes: true });
  }
  while (dias.length % 7 !== 0) {
    const ultima = dias[dias.length - 1].data;
    dias.push({
      data: new Date(ultima.getFullYear(), ultima.getMonth(), ultima.getDate() + 1),
      noMes: false,
    });
  }
  return dias;
}

function agruparPorSemana(dias: DiaGrade[]): DiaGrade[][] {
  const semanas: DiaGrade[][] = [];
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7));
  }
  return semanas;
}

type EstadoSincronizacao =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; quantidade: number }
  | { status: "error"; message: string };

export function CalendarioView({
  eventosIniciais,
  anoInicial,
  mesInicial,
}: {
  eventosIniciais: EventoCalendarioComRelacoes[];
  anoInicial: number;
  mesInicial: number;
}) {
  const router = useRouter();

  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [eventos, setEventos] = useState(eventosIniciais);
  const [isPending, startTransition] = useTransition();
  const [sincronizacao, setSincronizacao] = useState<EstadoSincronizacao>({ status: "idle" });
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoCalendarioComRelacoes | null>(
    null,
  );
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  function irParaMes(novoAno: number, novoMes: number) {
    startTransition(async () => {
      const novosEventos = await getEventos(novoAno, novoMes);
      setAno(novoAno);
      setMes(novoMes);
      setEventos(novosEventos);
    });
  }

  function handleMesAnterior() {
    irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
  }

  function handleProximoMes() {
    irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
  }

  function handleSincronizar() {
    setSincronizacao({ status: "pending" });
    startTransition(async () => {
      const resultado = await sincronizarFeriadosAction(ano);
      if (!resultado.success) {
        setSincronizacao({ status: "error", message: resultado.error });
        return;
      }
      setSincronizacao({ status: "done", quantidade: resultado.quantidade });
      const novosEventos = await getEventos(ano, mes);
      setEventos(novosEventos);
    });
  }

  function handleExcluir() {
    if (!eventoSelecionado) return;
    setExcluindo(true);
    startTransition(async () => {
      const resultado = await deleteEvento(eventoSelecionado.id);
      setExcluindo(false);
      if (!resultado.error) {
        setEventos((atual) => atual.filter((evento) => evento.id !== eventoSelecionado.id));
        setEventoSelecionado(null);
        setConfirmandoExclusao(false);
      }
    });
  }

  const dias = useMemo(() => gerarDiasGrade(ano, mes), [ano, mes]);
  const semanas = useMemo(() => agruparPorSemana(dias), [dias]);
  const hojeISO = useMemo(() => toISODate(new Date()), []);

  // Expande cada evento em todos os dias do seu intervalo (data_inicio..data_fim)
  // pra pintar a pílula em cada célula correspondente da grade.
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendarioComRelacoes[]>();
    for (const evento of eventos) {
      let cursor = evento.data_inicio;
      const fim = evento.data_fim ?? evento.data_inicio;
      let contador = 0;
      while (cursor <= fim && contador < LIMITE_DIAS_EVENTO) {
        const lista = mapa.get(cursor) ?? [];
        lista.push(evento);
        mapa.set(cursor, lista);
        cursor = proximoDiaISO(cursor);
        contador += 1;
      }
    }
    return mapa;
  }, [eventos]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleMesAnterior}
            disabled={isPending}
            aria-label="Mês anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="w-40 text-center text-lg font-semibold">
            {NOMES_MES[mes - 1]} {ano}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleProximoMes}
            disabled={isPending}
            aria-label="Próximo mês"
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleSincronizar} disabled={isPending}>
            {sincronizacao.status === "pending" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Sincronizar feriados nacionais
          </Button>
          <Button render={<Link href={`/admin/calendario/novo?data=${hojeISO}`} />} nativeButton={false}>
            <Plus />
            Novo evento
          </Button>
        </div>
      </div>

      {sincronizacao.status === "done" && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {sincronizacao.quantidade > 0
            ? `${sincronizacao.quantidade} feriado(s) nacional(is) sincronizado(s) para ${ano}.`
            : `A BrasilAPI não retornou feriados para ${ano}.`}
        </p>
      )}
      {sincronizacao.status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {sincronizacao.message}
        </p>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid grid-cols-7 border-b">
          {DIAS_SEMANA_CURTO.map((dia) => (
            <div
              key={dia}
              className="text-muted-foreground border-r p-2 text-center text-xs font-medium last:border-r-0"
            >
              {dia}
            </div>
          ))}
        </div>
        {semanas.map((semana, indiceSemana) => (
          <div key={indiceSemana} className="grid grid-cols-7 border-b last:border-b-0">
            {semana.map(({ data, noMes }) => {
              const iso = toISODate(data);
              const eventosDoDia = eventosPorDia.get(iso) ?? [];
              const ehHoje = iso === hojeISO;

              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/calendario/novo?data=${iso}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") router.push(`/admin/calendario/novo?data=${iso}`);
                  }}
                  className={cn(
                    "hover:bg-muted/50 flex min-h-24 cursor-pointer flex-col gap-1 border-r p-1.5 text-left last:border-r-0",
                    !noMes && "bg-muted/20 text-muted-foreground",
                    ehHoje && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium",
                      ehHoje && "text-primary font-semibold",
                    )}
                  >
                    {data.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {eventosDoDia.slice(0, 3).map((evento) => (
                      <button
                        key={evento.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEventoSelecionado(evento);
                        }}
                        title={evento.nome}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                          EVENTO_TIPO_BADGE_CLASS[evento.tipo],
                        )}
                      >
                        {evento.nome}
                      </button>
                    ))}
                    {eventosDoDia.length > 3 && (
                      <span className="text-muted-foreground px-1.5 text-[10px]">
                        +{eventosDoDia.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      <Dialog
        open={eventoSelecionado !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEventoSelecionado(null);
            setConfirmandoExclusao(false);
          }
        }}
      >
        <DialogContent>
          {eventoSelecionado && (
            <>
              <DialogHeader>
                <DialogTitle>{eventoSelecionado.nome}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={EVENTO_TIPO_BADGE_CLASS[eventoSelecionado.tipo]}>
                    {EVENTO_TIPO_LABELS[eventoSelecionado.tipo]}
                  </Badge>
                  {eventoSelecionado.tipo_feriado && (
                    <span className="text-muted-foreground text-xs">
                      {TIPO_FERIADO_LABELS[eventoSelecionado.tipo_feriado]}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">
                  Data:{" "}
                  <span className="text-foreground">
                    {formatDataBR(eventoSelecionado.data_inicio)}
                    {eventoSelecionado.data_fim &&
                    eventoSelecionado.data_fim !== eventoSelecionado.data_inicio
                      ? ` → ${formatDataBR(eventoSelecionado.data_fim)}`
                      : ""}
                  </span>
                </p>
                {(eventoSelecionado.horario_inicio || eventoSelecionado.horario_fim) && (
                  <p className="text-muted-foreground">
                    Horário:{" "}
                    <span className="text-foreground">
                      {formatHorario(eventoSelecionado.horario_inicio, eventoSelecionado.horario_fim)}
                    </span>
                  </p>
                )}
                <p className="text-muted-foreground">
                  Abrangência:{" "}
                  <span className="text-foreground">
                    {ABRANGENCIA_LABELS[eventoSelecionado.abrangencia]}
                    {eventoSelecionado.abrangencia === "curso" && eventoSelecionado.cursos
                      ? ` — ${eventoSelecionado.cursos.nome}`
                      : ""}
                    {eventoSelecionado.abrangencia === "turma" && eventoSelecionado.turmas
                      ? ` — ${eventoSelecionado.turmas.nome}`
                      : ""}
                  </span>
                </p>
                {(eventoSelecionado.gera_notificacao ||
                  eventoSelecionado.impacta_aulas ||
                  eventoSelecionado.bloqueia_frequencia) && (
                  <p className="text-muted-foreground text-xs">
                    {[
                      eventoSelecionado.gera_notificacao && "Gera notificação",
                      eventoSelecionado.impacta_aulas && "Impacta aulas",
                      eventoSelecionado.bloqueia_frequencia && "Bloqueia frequência",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {eventoSelecionado.observacoes && (
                  <p className="text-muted-foreground border-t pt-2">
                    {eventoSelecionado.observacoes}
                  </p>
                )}
              </div>
              <DialogFooter>
                {confirmandoExclusao ? (
                  <>
                    <span className="text-destructive mr-auto self-center text-sm">
                      Excluir este evento?
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmandoExclusao(false)}
                      disabled={excluindo}
                    >
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
                      {excluindo ? "Excluindo..." : "Confirmar exclusão"}
                    </Button>
                  </>
                ) : (
                  <Button variant="destructive" onClick={() => setConfirmandoExclusao(true)}>
                    <Trash2 />
                    Excluir evento
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
