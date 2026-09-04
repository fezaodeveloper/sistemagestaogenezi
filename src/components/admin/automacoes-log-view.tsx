"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { getEventosAutomacao, reprocessarEventoAction } from "@/app/admin/automacoes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
import { LIMITE_PADRAO, calcularTotalPaginas } from "@/lib/paginacao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EVENTO_AUTOMACAO_STATUS_BADGE_CLASS,
  EVENTO_AUTOMACAO_STATUS_LABELS,
  EVENTO_AUTOMACAO_TIPOS,
  type EventoAutomacao,
} from "@/lib/automacoes/schema";

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...EVENTO_AUTOMACAO_STATUS_LABELS,
};

function formatarData(data: string): string {
  return new Date(data).toLocaleString("pt-BR");
}

function ReprocessarButton({
  eventoId,
  onReprocessado,
}: {
  eventoId: string;
  onReprocessado: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleReprocessar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await reprocessarEventoAction(eventoId);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      onReprocessado();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={isPending} onClick={handleReprocessar}>
        {isPending ? "Reprocessando..." : "Reprocessar"}
      </Button>
      {erro && <span className="text-destructive text-xs">{erro}</span>}
    </div>
  );
}

// Busca com debounce + sugestões (TAREFA 1) — trocou o Select suspenso com
// todos os tipos por esse padrão, mesmo usado em aula-busca-chamada-form.tsx
// e no wizard de matrícula. Module scope (não recriado a cada render do
// AutomacoesLogView).
function TipoBuscaInput({
  tipoSelecionado,
  onSelecionar,
  onLimpar,
}: {
  tipoSelecionado: string | null;
  onSelecionar: (tipo: string) => void;
  onLimpar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setTermoDebounced(busca.trim().toLowerCase()), 300);
    return () => clearTimeout(timeoutId);
  }, [busca]);

  const sugestoes =
    termoDebounced.length === 0
      ? EVENTO_AUTOMACAO_TIPOS
      : EVENTO_AUTOMACAO_TIPOS.filter((tipo) => tipo.toLowerCase().includes(termoDebounced));

  return (
    <div className="relative flex flex-col gap-1">
      <Label className="text-xs">Tipo</Label>

      {tipoSelecionado ? (
        <Badge variant="secondary" className="flex w-fit items-center gap-1.5 py-1.5 pr-1.5 pl-2.5 font-mono text-xs">
          {tipoSelecionado}
          <button
            type="button"
            onClick={onLimpar}
            className="hover:bg-muted-foreground/20 rounded-full p-0.5"
            aria-label="Limpar filtro de tipo"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ) : (
        <Input
          placeholder="Buscar por tipo de evento..."
          className="w-56"
          value={busca}
          onChange={(event) => {
            setBusca(event.target.value);
            setSugestoesAbertas(true);
          }}
          onFocus={() => setSugestoesAbertas(true)}
          onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
        />
      )}

      {sugestoesAbertas && !tipoSelecionado && (
        <div className="bg-popover absolute top-full left-0 z-10 mt-1 flex w-56 flex-col overflow-hidden rounded-md border shadow-md">
          {sugestoes.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">Nenhum tipo encontrado.</p>
          ) : (
            sugestoes.slice(0, 15).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelecionar(tipo);
                  setBusca("");
                  setSugestoesAbertas(false);
                }}
                className="hover:bg-muted border-b p-2 text-left font-mono text-xs last:border-b-0"
              >
                {tipo}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AutomacoesLogView({
  eventosIniciais,
  totalInicial,
}: {
  eventosIniciais: EventoAutomacao[];
  totalInicial: number;
}) {
  const [eventos, setEventos] = useState(eventosIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(LIMITE_PADRAO);
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [isPending, startTransition] = useTransition();

  // Centraliza a busca (mesmo racional de `buscar` em financeiro-view.tsx):
  // sempre lê os filtros e a página/limite atuais, evita duplicar a lógica
  // entre o botão "Filtrar" e a paginação.
  function buscar(novaPagina: number, novoLimite: number) {
    startTransition(async () => {
      const resultado = await getEventosAutomacao({
        page: novaPagina,
        limit: novoLimite,
        tipo: tipoFiltro ?? undefined,
        status: statusFiltro !== STATUS_FILTRO_TODOS ? statusFiltro : undefined,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      });
      setEventos(resultado.eventos);
      setTotal(resultado.total);
      setPagina(novaPagina);
      setLimite(novoLimite);
    });
  }

  function handleFiltrar() {
    buscar(1, limite);
  }

  function handlePaginar(novaPagina: number, novoLimite: number) {
    buscar(novaPagina, novoLimite);
  }

  function handleReprocessado() {
    buscar(pagina, limite);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TipoBuscaInput
          tipoSelecionado={tipoFiltro}
          onSelecionar={setTipoFiltro}
          onLimpar={() => setTipoFiltro(null)}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Status</Label>
          <Select
            items={STATUS_FILTRO_ITEMS}
            value={statusFiltro}
            onValueChange={(value) => setStatusFiltro(value as string)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STATUS_FILTRO_ITEMS).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_FILTRO_ITEMS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="data_inicio" className="text-xs">
            De:
          </Label>
          <Input
            id="data_inicio"
            type="date"
            value={dataInicio}
            onChange={(event) => setDataInicio(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="data_fim" className="text-xs">
            Até:
          </Label>
          <Input
            id="data_fim"
            type="date"
            value={dataFim}
            onChange={(event) => setDataFim(event.target.value)}
            className="w-40"
          />
        </div>
        <Button type="button" size="sm" onClick={handleFiltrar} disabled={isPending}>
          {isPending ? "Filtrando..." : "Filtrar"}
        </Button>
      </div>

      {eventos.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {total === 0
            ? "Nenhum evento de automação registrado ainda."
            : "Nenhum evento encontrado com os filtros aplicados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventos.map((evento) => (
              <TableRow key={evento.id}>
                <TableCell className="whitespace-nowrap">{formatarData(evento.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">{evento.tipo}</TableCell>
                <TableCell>
                  <Badge className={EVENTO_AUTOMACAO_STATUS_BADGE_CLASS[evento.status]}>
                    {EVENTO_AUTOMACAO_STATUS_LABELS[evento.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {evento.tentativas}/{evento.max_tentativas}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                  {evento.erro ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {evento.status === "falhou" && (
                    <ReprocessarButton eventoId={evento.id} onReprocessado={handleReprocessado} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Paginacao
        paginaAtual={pagina}
        totalPaginas={calcularTotalPaginas(total, limite)}
        totalRegistros={total}
        limite={limite}
        onNavigate={handlePaginar}
      />
    </div>
  );
}
