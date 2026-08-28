"use client";

import { useMemo, useState, useTransition } from "react";
import { reprocessarEventoAction } from "@/app/admin/automacoes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const TIPO_FILTRO_TODOS = "todos";
const TIPO_FILTRO_ITEMS: Record<string, string> = {
  [TIPO_FILTRO_TODOS]: "Todos os tipos",
  ...Object.fromEntries(EVENTO_AUTOMACAO_TIPOS.map((tipo) => [tipo, tipo])),
};

function formatarData(data: string): string {
  return new Date(data).toLocaleString("pt-BR");
}

function ReprocessarButton({ eventoId }: { eventoId: string }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleReprocessar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await reprocessarEventoAction(eventoId);
      if (resultado.error) setErro(resultado.error);
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

export function AutomacoesLogView({ eventos }: { eventos: EventoAutomacao[] }) {
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [tipoFiltro, setTipoFiltro] = useState<string>(TIPO_FILTRO_TODOS);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((evento) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && evento.status !== statusFiltro) return false;
      if (tipoFiltro !== TIPO_FILTRO_TODOS && evento.tipo !== tipoFiltro) return false;
      return true;
    });
  }, [eventos, statusFiltro, tipoFiltro]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
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
        <Select
          items={TIPO_FILTRO_ITEMS}
          value={tipoFiltro}
          onValueChange={(value) => setTipoFiltro(value as string)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(TIPO_FILTRO_ITEMS).map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {TIPO_FILTRO_ITEMS[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {eventosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {eventos.length === 0
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
            {eventosFiltrados.map((evento) => (
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
                  {evento.status === "falhou" && <ReprocessarButton eventoId={evento.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
