"use client";

import { useMemo, useState } from "react";
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
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
  type ParcelaStatus,
} from "@/lib/financeiro/schema";

export type ParcelaAlunoRow = {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ParcelaStatus;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
  matriculas: { turmas: { cursos: { nome: string } | null } | null } | null;
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos",
  ...PARCELA_STATUS_LABELS,
};

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function AlunoFinanceiroView({ parcelas }: { parcelas: ParcelaAlunoRow[] }) {
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);

  const parcelasFiltradas = useMemo(
    () =>
      parcelas.filter(
        (parcela) => statusFiltro === STATUS_FILTRO_TODOS || parcela.status === statusFiltro,
      ),
    [parcelas, statusFiltro],
  );

  return (
    <div className="flex flex-col gap-4">
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

      {parcelas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Você ainda não tem parcelas registradas.
        </p>
      ) : parcelasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma parcela encontrada com o filtro selecionado.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcelasFiltradas.map((parcela) => (
              <TableRow key={parcela.id}>
                <TableCell>{parcela.matriculas?.turmas?.cursos?.nome ?? "—"}</TableCell>
                <TableCell>{parcela.numero_parcela}</TableCell>
                <TableCell>{formatDataBR(parcela.data_vencimento)}</TableCell>
                <TableCell>{formatValor(Number(parcela.valor))}</TableCell>
                <TableCell>
                  <Badge className={PARCELA_STATUS_BADGE_CLASS[parcela.status]}>
                    {PARCELA_STATUS_LABELS[parcela.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {parcela.status === "pago" ? (
                    <span className="text-muted-foreground text-xs">
                      Pago em {formatDataBR(parcela.data_pagamento)}
                    </span>
                  ) : parcela.status === "cancelado" || parcela.status === "estornado" ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : parcela.asaas_invoice_url ? (
                    <Button
                      size="sm"
                      render={
                        <a href={parcela.asaas_invoice_url} target="_blank" rel="noopener noreferrer" />
                      }
                      nativeButton={false}
                    >
                      Pagar
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">Aguardando cobrança</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
