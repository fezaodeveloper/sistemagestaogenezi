"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { criarGasto, getGastos } from "@/app/admin/financeiro/gastos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { GASTO_CATEGORIAS, GASTO_CATEGORIA_LABELS, type Gasto } from "@/lib/financeiro/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CATEGORIA_FILTRO_TODAS = "todas";
const CATEGORIA_FILTRO_ITEMS: Record<string, string> = {
  [CATEGORIA_FILTRO_TODAS]: "Todas as categorias",
  ...GASTO_CATEGORIA_LABELS,
};

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function NovoGastoDialog({ onCriado }: { onCriado: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarGasto(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onCriado();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Novo gasto
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo gasto</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select name="categoria" items={GASTO_CATEGORIA_LABELS} defaultValue="outro">
                <SelectTrigger id="categoria" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GASTO_CATEGORIAS.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {GASTO_CATEGORIA_LABELS[categoria]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor</Label>
              <Input id="valor" name="valor" type="number" step="0.01" min={0.01} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_gasto">Data do gasto</Label>
            <Input id="data_gasto" name="data_gasto" type="date" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Input id="forma_pagamento" name="forma_pagamento" placeholder="Opcional" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="recorrente" className="font-normal">
              Gasto recorrente
            </Label>
            <Switch id="recorrente" name="recorrente" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" name="observacoes" placeholder="Opcional" />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GastosView({
  gastosIniciais,
  anoInicial,
  mesInicial,
}: {
  gastosIniciais: Gasto[];
  anoInicial: number;
  mesInicial: number;
}) {
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [gastos, setGastos] = useState(gastosIniciais);
  const [isPending, startTransition] = useTransition();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(CATEGORIA_FILTRO_TODAS);

  function irParaMes(novoAno: number, novoMes: number) {
    startTransition(async () => {
      const novosGastos = await getGastos(novoAno, novoMes);
      setAno(novoAno);
      setMes(novoMes);
      setGastos(novosGastos);
    });
  }

  function recarregar() {
    startTransition(async () => {
      const novosGastos = await getGastos(ano, mes);
      setGastos(novosGastos);
    });
  }

  function handleMesAnterior() {
    irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
  }

  function handleProximoMes() {
    irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
  }

  const gastosFiltrados = useMemo(() => {
    return gastos.filter(
      (gasto) => categoriaFiltro === CATEGORIA_FILTRO_TODAS || gasto.categoria === categoriaFiltro,
    );
  }, [gastos, categoriaFiltro]);

  const total = useMemo(
    () => gastosFiltrados.reduce((soma, gasto) => soma + Number(gasto.valor), 0),
    [gastosFiltrados],
  );

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
        <NovoGastoDialog onCriado={recarregar} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="gz-kpi gz-kpi-red">
          <CardContent className="flex flex-col gap-1.5 py-4">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Total de gastos no mês
            </span>
            <span className="gz-num text-[22px]" style={{ color: "#FF5A5F" }}>
              {formatValor(total)}
            </span>
          </CardContent>
        </Card>
      </div>

      <Select
        items={CATEGORIA_FILTRO_ITEMS}
        value={categoriaFiltro}
        onValueChange={(value) => setCategoriaFiltro(value as string)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(CATEGORIA_FILTRO_ITEMS).map((categoria) => (
            <SelectItem key={categoria} value={categoria}>
              {CATEGORIA_FILTRO_ITEMS[categoria]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {gastosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum gasto registrado em {NOMES_MES[mes - 1]} de {ano}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Forma de pagamento</TableHead>
              <TableHead>Recorrente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gastosFiltrados.map((gasto) => (
              <TableRow key={gasto.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{gasto.descricao}</span>
                    {gasto.observacoes && (
                      <span className="text-muted-foreground text-xs">{gasto.observacoes}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{GASTO_CATEGORIA_LABELS[gasto.categoria]}</Badge>
                </TableCell>
                <TableCell>{formatValor(Number(gasto.valor))}</TableCell>
                <TableCell>{formatDataBR(gasto.data_gasto)}</TableCell>
                <TableCell>{gasto.forma_pagamento ?? "—"}</TableCell>
                <TableCell>{gasto.recorrente ? "Sim" : "Não"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
