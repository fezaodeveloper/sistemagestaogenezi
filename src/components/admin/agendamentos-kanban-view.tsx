"use client";

// "use client": drag-and-drop (eventos nativos do navegador), atualização
// otimista de status e dialogs de confirmação.

import { useEffect, useOptimistic, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Trash2 } from "lucide-react";
import {
  atualizarStatusAgendamento,
  excluirAgendamento,
} from "@/app/admin/comercial/agendamentos/actions";
import type { ResumoAgendamentos } from "@/lib/agendamentos/agendamentos";
import {
  AGENDAMENTO_STATUS_BADGE_CLASS,
  type Agendamento,
  type AgendamentoStatus,
  type CampoExtra,
} from "@/lib/agendamentos/schema";
import { LIMITE_PADRAO } from "@/lib/paginacao";
import { AgendamentoReagendarDialog } from "@/components/admin/agendamento-reagendar-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// "Agendado" é o status `confirmado` (o padrão de todo agendamento novo).
// `cancelado` não tem coluna — não aparece no Kanban (ver
// getAgendamentosPaginados).
type StatusColuna = Exclude<AgendamentoStatus, "cancelado">;

const COLUNAS: { status: StatusColuna; titulo: string }[] = [
  { status: "confirmado", titulo: "Agendado" },
  { status: "faltou", titulo: "Faltou" },
  { status: "realizado", titulo: "Realizado" },
];

const COLUNA_ITEMS: Record<string, string> = Object.fromEntries(COLUNAS.map((c) => [c.status, c.titulo]));

function formatDateBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Preferência de visualização (Card/Lista): fica só neste navegador.
type Visualizacao = "card" | "lista";
const CHAVE_VISUALIZACAO = "agendamentos_visualizacao";

function lerVisualizacao(): Visualizacao | null {
  try {
    const salva = localStorage.getItem(CHAVE_VISUALIZACAO);
    return salva === "card" || salva === "lista" ? salva : null;
  } catch {
    return null; // localStorage indisponível (modo privado etc.) — cai no padrão.
  }
}

function LinhaAgendamento({
  agendamento,
  camposExtrasConfigurados,
  arrastando,
  onMover,
  onExcluir,
  onReagendado,
  onDragStart,
  onDragEnd,
}: {
  agendamento: Agendamento;
  camposExtrasConfigurados: CampoExtra[];
  arrastando: boolean;
  onMover: (status: StatusColuna) => void;
  onExcluir: () => void;
  onReagendado: () => void;
  onDragStart: (event: DragEvent<HTMLTableRowElement>) => void;
  onDragEnd: () => void;
}) {
  const camposExtras = camposExtrasConfigurados
    .map((campo) => agendamento.campos_extras?.[campo.nome])
    .filter(Boolean)
    .join(" · ");
  const tituloStatus = COLUNA_ITEMS[agendamento.status] ?? agendamento.status;

  return (
    <TableRow
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing ${arrastando ? "opacity-40" : ""}`}
    >
      <TableCell className="max-w-64 align-top">
        <p className="font-medium">{agendamento.nome}</p>
        {camposExtras && <p className="text-muted-foreground text-xs">{camposExtras}</p>}
        {agendamento.mensagem && (
          <p className="text-muted-foreground line-clamp-2 text-xs whitespace-normal" title={agendamento.mensagem}>
            💬 {agendamento.mensagem}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <a
          href={`https://wa.me/55${agendamento.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {agendamento.whatsapp}
        </a>
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">{formatDateBR(agendamento.data_agendada)}</TableCell>
      <TableCell className="align-top">{agendamento.horario}</TableCell>
      <TableCell className="align-top">
        <Badge className={AGENDAMENTO_STATUS_BADGE_CLASS[agendamento.status]}>{tituloStatus}</Badge>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex items-center justify-end gap-2">
          {agendamento.status === "faltou" && (
            <AgendamentoReagendarDialog agendamento={agendamento} onReagendado={onReagendado} />
          )}
          {/* Alternativa ao arrastar (que não funciona em celular/tablet). */}
          <Select
            items={COLUNA_ITEMS}
            value={agendamento.status}
            onValueChange={(valor) => valor && onMover(valor as StatusColuna)}
          >
            <SelectTrigger className="h-8 w-32 text-xs" aria-label="Mover para">
              <SelectValue placeholder="Mover para..." />
            </SelectTrigger>
            <SelectContent>
              {COLUNAS.map((coluna) => (
                <SelectItem key={coluna.status} value={coluna.status}>
                  {coluna.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive shrink-0"
            onClick={onExcluir}
            aria-label="Excluir agendamento"
            title="Excluir agendamento"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CardAgendamento({
  agendamento,
  camposExtrasConfigurados,
  arrastando,
  onMover,
  onExcluir,
  onReagendado,
  onDragStart,
  onDragEnd,
}: {
  agendamento: Agendamento;
  camposExtrasConfigurados: CampoExtra[];
  arrastando: boolean;
  onMover: (status: StatusColuna) => void;
  onExcluir: () => void;
  onReagendado: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const camposExtras = camposExtrasConfigurados
    .map((campo) => agendamento.campos_extras?.[campo.nome])
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing ${arrastando ? "opacity-40" : ""}`}
    >
      <Card>
        <CardContent className="flex flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{agendamento.nome}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive -mt-1 -mr-1 shrink-0"
              onClick={onExcluir}
              aria-label="Excluir agendamento"
              title="Excluir agendamento"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          <a
            href={`https://wa.me/55${agendamento.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground w-fit text-xs hover:underline"
          >
            📱 {agendamento.whatsapp}
          </a>

          <p className="text-xs">
            📅 {formatDateBR(agendamento.data_agendada)} às {agendamento.horario}
          </p>

          {camposExtras && <p className="text-muted-foreground text-xs">{camposExtras}</p>}

          {agendamento.mensagem && (
            <p className="text-muted-foreground line-clamp-3 text-xs" title={agendamento.mensagem}>
              💬 {agendamento.mensagem}
            </p>
          )}

          {agendamento.status === "faltou" && (
            <AgendamentoReagendarDialog agendamento={agendamento} onReagendado={onReagendado} />
          )}

          {/* Alternativa ao arrastar — HTML5 drag-and-drop não funciona em
              celular/tablet, e assim o Kanban também é operável por teclado. */}
          <Select
            items={COLUNA_ITEMS}
            value={agendamento.status}
            onValueChange={(valor) => valor && onMover(valor as StatusColuna)}
          >
            <SelectTrigger className="h-8 text-xs" aria-label="Mover para">
              <SelectValue placeholder="Mover para..." />
            </SelectTrigger>
            <SelectContent>
              {COLUNAS.map((coluna) => (
                <SelectItem key={coluna.status} value={coluna.status}>
                  {coluna.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}

export function AgendamentosKanbanView({
  paginaId,
  agendamentos,
  camposExtrasConfigurados,
  resumo,
  dataFiltro,
  totalRegistros,
  paginaAtual,
  totalPaginas,
}: {
  paginaId: string;
  agendamentos: Agendamento[];
  camposExtrasConfigurados: CampoExtra[];
  resumo: ResumoAgendamentos;
  dataFiltro: string;
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
}) {
  const router = useRouter();
  const [data, setData] = useState(dataFiltro);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [colunaSobre, setColunaSobre] = useState<StatusColuna | null>(null);
  const [excluindo, setExcluindo] = useState<Agendamento | null>(null);
  const [isPending, startTransition] = useTransition();
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("card");

  // localStorage só existe no client: restaura a preferência em efeito (nunca
  // no render inicial, senão o HTML do server diverge do client e dá hydration
  // mismatch). O queueMicrotask evita setState síncrono no corpo do efeito.
  useEffect(() => {
    queueMicrotask(() => {
      const salva = lerVisualizacao();
      if (salva) setVisualizacao(salva);
    });
  }, []);

  function escolherVisualizacao(nova: Visualizacao) {
    setVisualizacao(nova);
    try {
      localStorage.setItem(CHAVE_VISUALIZACAO, nova);
    } catch {
      // Sem localStorage a preferência só vale até recarregar.
    }
  }

  // Atualização otimista: o card muda de coluna na hora, sem esperar a Server
  // Action. Se ela falhar, o React descarta o estado otimista sozinho ao fim
  // da transição e o card volta pra coluna de origem.
  const [visiveis, aplicarMovimento] = useOptimistic(
    agendamentos,
    (atuais, movimento: { id: string; status: AgendamentoStatus }) =>
      atuais.map((a) => (a.id === movimento.id ? { ...a, status: movimento.status } : a)),
  );

  function mover(agendamento: Agendamento, status: StatusColuna) {
    if (agendamento.status === status) return;
    setErro(null);
    startTransition(async () => {
      aplicarMovimento({ id: agendamento.id, status });
      const resultado = await atualizarStatusAgendamento(agendamento.id, status);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirAgendamento(alvo.id);
      setExcluindo(null);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: StatusColuna) {
    event.preventDefault();
    setColunaSobre(null);
    const id = event.dataTransfer.getData("text/plain") || arrastandoId;
    setArrastandoId(null);
    const agendamento = visiveis.find((a) => a.id === id);
    if (agendamento) mover(agendamento, status);
  }

  function handleDataChange(valor: string) {
    setData(valor);
    router.push(
      valor ? `/admin/comercial/agendamentos/${paginaId}?data=${valor}` : `/admin/comercial/agendamentos/${paginaId}`,
    );
  }

  const paginacaoSearchParams: Record<string, string> = {};
  if (dataFiltro) paginacaoSearchParams.data = dataFiltro;

  return (
    <div className="flex flex-col gap-4">
      {/* Histórico completo da página — ignora filtro de data e paginação. */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col gap-0.5 p-3">
            <span className="text-muted-foreground text-xs">Total agendados</span>
            <span className="text-2xl font-semibold">{resumo.total}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-0.5 p-3">
            <span className="text-muted-foreground text-xs">Realizados</span>
            <span className="text-2xl font-semibold text-green-600 dark:text-green-400">{resumo.realizado}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-0.5 p-3">
            <span className="text-muted-foreground text-xs">Faltou</span>
            <span className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{resumo.faltou}</span>
          </CardContent>
        </Card>
      </div>
      {resumo.cancelado > 0 && (
        <p className="text-muted-foreground -mt-2 text-xs">
          O total inclui {resumo.cancelado} agendamento(s) cancelado(s), que não aparecem no Kanban.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">Data</span>
          <Input type="date" value={data} onChange={(event) => handleDataChange(event.target.value)} className="w-40" />
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5" role="group" aria-label="Modo de visualização">
          <Button
            type="button"
            size="sm"
            variant={visualizacao === "card" ? "secondary" : "ghost"}
            aria-pressed={visualizacao === "card"}
            onClick={() => escolherVisualizacao("card")}
          >
            <LayoutGrid />
            Card
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visualizacao === "lista" ? "secondary" : "ghost"}
            aria-pressed={visualizacao === "lista"}
            onClick={() => escolherVisualizacao("lista")}
          >
            <List />
            Lista
          </Button>
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {visiveis.length === 0 ? (
        <Card>
          <p className="text-muted-foreground py-10 text-center text-sm">
            {dataFiltro
              ? "Nenhum agendamento encontrado nessa data."
              : "Nenhum agendamento ainda para esta página."}
          </p>
        </Card>
      ) : visualizacao === "lista" ? (
        <div className="flex flex-col gap-3">
          {/* Zonas de soltura: arrastar uma linha até um status o move (mesmo
              efeito das colunas do Kanban). */}
          <div className="grid grid-cols-3 gap-2">
            {COLUNAS.map((coluna) => (
              <div
                key={coluna.status}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setColunaSobre(coluna.status);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setColunaSobre(null);
                }}
                onDrop={(event) => handleDrop(event, coluna.status)}
                className={`flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm transition-colors ${
                  colunaSobre === coluna.status ? "bg-muted ring-primary/40 ring-2" : ""
                } ${AGENDAMENTO_STATUS_BADGE_CLASS[coluna.status]}`}
              >
                <span className="font-semibold">{coluna.titulo}</span>
                <Badge variant="outline" className="bg-background/60">
                  {visiveis.filter((a) => a.status === coluna.status).length}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">Arraste uma linha até um status acima para movê-la.</p>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((agendamento) => (
                  <LinhaAgendamento
                    key={agendamento.id}
                    agendamento={agendamento}
                    camposExtrasConfigurados={camposExtrasConfigurados}
                    arrastando={arrastandoId === agendamento.id}
                    onMover={(status) => mover(agendamento, status)}
                    onExcluir={() => setExcluindo(agendamento)}
                    onReagendado={() => router.refresh()}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", agendamento.id);
                      event.dataTransfer.effectAllowed = "move";
                      setArrastandoId(agendamento.id);
                    }}
                    onDragEnd={() => {
                      setArrastandoId(null);
                      setColunaSobre(null);
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUNAS.map((coluna) => {
            const cards = visiveis.filter((a) => a.status === coluna.status);
            return (
              <div
                key={coluna.status}
                onDragOver={(event) => {
                  event.preventDefault(); // sem isso o navegador não aceita o drop
                  event.dataTransfer.dropEffect = "move";
                  setColunaSobre(coluna.status);
                }}
                onDragLeave={(event) => {
                  // dragleave também dispara ao entrar num filho — só limpa
                  // quando o cursor realmente saiu da coluna.
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setColunaSobre(null);
                }}
                onDrop={(event) => handleDrop(event, coluna.status)}
                className={`flex flex-col gap-3 rounded-lg p-2 transition-colors ${
                  colunaSobre === coluna.status ? "bg-muted ring-primary/40 ring-2" : ""
                }`}
              >
                <div
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${AGENDAMENTO_STATUS_BADGE_CLASS[coluna.status]}`}
                >
                  <span className="text-sm font-semibold">{coluna.titulo}</span>
                  <Badge variant="outline" className="bg-background/60">
                    {cards.length}
                  </Badge>
                </div>

                {cards.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">Nenhum agendamento aqui.</p>
                ) : (
                  cards.map((agendamento) => (
                    <CardAgendamento
                      key={agendamento.id}
                      agendamento={agendamento}
                      camposExtrasConfigurados={camposExtrasConfigurados}
                      arrastando={arrastandoId === agendamento.id}
                      onMover={(status) => mover(agendamento, status)}
                      onExcluir={() => setExcluindo(agendamento)}
                      onReagendado={() => router.refresh()}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", agendamento.id);
                        event.dataTransfer.effectAllowed = "move";
                        setArrastandoId(agendamento.id);
                      }}
                      onDragEnd={() => {
                        setArrastandoId(null);
                        setColunaSobre(null);
                      }}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={LIMITE_PADRAO}
        baseUrl={`/admin/comercial/agendamentos/${paginaId}`}
        searchParams={paginacaoSearchParams}
      />

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento de &quot;{excluindo?.nome}&quot; (
              {excluindo ? `${formatDateBR(excluindo.data_agendada)} às ${excluindo.horario}` : ""})? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={confirmarExclusao}>
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
