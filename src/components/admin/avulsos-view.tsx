"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  criarPagamentoAvulso,
  getPagamentosAvulsos,
  type AlunoOpcao,
  type PagamentoAvulsoComAluno,
} from "@/app/admin/financeiro/avulsos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  FORMAS_PAGAMENTO_AVULSO,
  FORMA_PAGAMENTO_AVULSO_LABELS,
  PAGAMENTO_AVULSO_TIPOS,
  PAGAMENTO_AVULSO_TIPO_LABELS,
} from "@/lib/financeiro/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIPO_FILTRO_TODOS = "todos";
const TIPO_FILTRO_ITEMS: Record<string, string> = {
  [TIPO_FILTRO_TODOS]: "Todos os tipos",
  ...PAGAMENTO_AVULSO_TIPO_LABELS,
};

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function NovoPagamentoDialog({
  alunos,
  onCriado,
}: {
  alunos: AlunoOpcao[];
  onCriado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const alunoItems: Record<string, string> = {
    "": "Nenhum (não vinculado)",
    ...Object.fromEntries(alunos.map((aluno) => [aluno.id, aluno.full_name ?? "—"])),
  };

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarPagamentoAvulso(formData);
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
            Novo pagamento
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo pagamento avulso</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" name="descricao" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select name="tipo" items={PAGAMENTO_AVULSO_TIPO_LABELS} defaultValue="receita">
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGAMENTO_AVULSO_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {PAGAMENTO_AVULSO_TIPO_LABELS[tipo]}
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
            <Label htmlFor="data_pagamento">Data do pagamento</Label>
            <Input id="data_pagamento" name="data_pagamento" type="date" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Select name="forma_pagamento" items={FORMA_PAGAMENTO_AVULSO_LABELS}>
              <SelectTrigger id="forma_pagamento" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO_AVULSO.map((formaPagamento) => (
                  <SelectItem key={formaPagamento} value={formaPagamento}>
                    {FORMA_PAGAMENTO_AVULSO_LABELS[formaPagamento]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aluno_id">Aluno vinculado</Label>
            <Select name="aluno_id" items={alunoItems} defaultValue="">
              <SelectTrigger id="aluno_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum (não vinculado)</SelectItem>
                {alunos.map((aluno) => (
                  <SelectItem key={aluno.id} value={aluno.id}>
                    {aluno.full_name ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {isPending ? "Salvando..." : "Registrar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AvulsosView({
  pagamentosIniciais,
  anoInicial,
  mesInicial,
  alunos,
}: {
  pagamentosIniciais: PagamentoAvulsoComAluno[];
  anoInicial: number;
  mesInicial: number;
  alunos: AlunoOpcao[];
}) {
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [pagamentos, setPagamentos] = useState(pagamentosIniciais);
  const [isPending, startTransition] = useTransition();
  const [tipoFiltro, setTipoFiltro] = useState<string>(TIPO_FILTRO_TODOS);

  function irParaMes(novoAno: number, novoMes: number) {
    startTransition(async () => {
      const novosPagamentos = await getPagamentosAvulsos(novoAno, novoMes);
      setAno(novoAno);
      setMes(novoMes);
      setPagamentos(novosPagamentos);
    });
  }

  function recarregar() {
    startTransition(async () => {
      const novosPagamentos = await getPagamentosAvulsos(ano, mes);
      setPagamentos(novosPagamentos);
    });
  }

  function handleMesAnterior() {
    irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
  }

  function handleProximoMes() {
    irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
  }

  const pagamentosFiltrados = useMemo(() => {
    return pagamentos.filter(
      (pagamento) => tipoFiltro === TIPO_FILTRO_TODOS || pagamento.tipo === tipoFiltro,
    );
  }, [pagamentos, tipoFiltro]);

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
        <NovoPagamentoDialog alunos={alunos} onCriado={recarregar} />
      </div>

      <Select
        items={TIPO_FILTRO_ITEMS}
        value={tipoFiltro}
        onValueChange={(value) => setTipoFiltro(value as string)}
      >
        <SelectTrigger className="w-48">
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

      {pagamentosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum pagamento avulso registrado em {NOMES_MES[mes - 1]} de {ano}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Forma de pagamento</TableHead>
              <TableHead>Aluno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagamentosFiltrados.map((pagamento) => (
              <TableRow key={pagamento.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{pagamento.descricao}</span>
                    {pagamento.observacoes && (
                      <span className="text-muted-foreground text-xs">{pagamento.observacoes}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{PAGAMENTO_AVULSO_TIPO_LABELS[pagamento.tipo]}</Badge>
                </TableCell>
                <TableCell>{formatValor(Number(pagamento.valor))}</TableCell>
                <TableCell>{formatDataBR(pagamento.data_pagamento)}</TableCell>
                <TableCell>
                  {pagamento.forma_pagamento
                    ? FORMA_PAGAMENTO_AVULSO_LABELS[pagamento.forma_pagamento]
                    : "—"}
                </TableCell>
                <TableCell>{pagamento.alunos?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
