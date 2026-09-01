"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  criarPagamentoAvulso,
  getPagamentosAvulsos,
  type AlunoOpcao,
  type PagamentoAvulsoComAluno,
} from "@/app/admin/financeiro/avulsos/actions";
import type { Categoria } from "@/app/admin/financeiro/categorias/actions";
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
import { FORMAS_PAGAMENTO_AVULSO, FORMA_PAGAMENTO_AVULSO_LABELS, PAGAMENTO_AVULSO_TIPO_LABELS } from "@/lib/financeiro/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CATEGORIA_FILTRO_TODAS = "todas";

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function CategoriaBadge({
  pagamento,
  categoriaPorId,
}: {
  pagamento: PagamentoAvulsoComAluno;
  categoriaPorId: Map<string, Categoria>;
}) {
  const categoria = pagamento.categoria_id ? categoriaPorId.get(pagamento.categoria_id) : null;

  if (categoria) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span className="inline-block size-2 rounded-full" style={{ backgroundColor: categoria.cor }} />
        {categoria.nome}
      </Badge>
    );
  }

  // Registro histórico (sem categoria_id) — só tem o campo "tipo" do enum
  // fixo antigo.
  return <Badge variant="outline">{PAGAMENTO_AVULSO_TIPO_LABELS[pagamento.tipo]}</Badge>;
}

function NovoPagamentoDialog({
  alunos,
  categorias,
  onCriado,
}: {
  alunos: AlunoOpcao[];
  categorias: Categoria[];
  onCriado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoriasAtivas = useMemo(() => categorias.filter((categoria) => categoria.ativo), [categorias]);
  const categoriaItems = Object.fromEntries(categoriasAtivas.map((categoria) => [categoria.id, categoria.nome]));

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
      setCategoriaId("");
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
              <Label htmlFor="categoria_id">Categoria</Label>
              <Select
                name="categoria_id"
                items={categoriaItems}
                value={categoriaId}
                onValueChange={(value) => setCategoriaId(value as string)}
              >
                <SelectTrigger id="categoria_id" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasAtivas.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
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
            <Button type="submit" disabled={isPending || !categoriaId}>
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
  categorias,
}: {
  pagamentosIniciais: PagamentoAvulsoComAluno[];
  anoInicial: number;
  mesInicial: number;
  alunos: AlunoOpcao[];
  categorias: Categoria[];
}) {
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [pagamentos, setPagamentos] = useState(pagamentosIniciais);
  const [isPending, startTransition] = useTransition();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(CATEGORIA_FILTRO_TODAS);
  const [modoFiltro, setModoFiltro] = useState<"mes" | "periodo">("mes");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const categoriaPorId = useMemo(() => new Map(categorias.map((categoria) => [categoria.id, categoria])), [categorias]);

  const categoriaFiltroItems: Record<string, string> = {
    [CATEGORIA_FILTRO_TODAS]: "Todas as categorias",
    ...Object.fromEntries(categorias.map((categoria) => [categoria.id, categoria.nome])),
  };

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
      const novosPagamentos =
        modoFiltro === "periodo" && periodoInicio && periodoFim
          ? await getPagamentosAvulsos(ano, mes, periodoInicio, periodoFim)
          : await getPagamentosAvulsos(ano, mes);
      setPagamentos(novosPagamentos);
    });
  }

  function handleMesAnterior() {
    irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
  }

  function handleProximoMes() {
    irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
  }

  function handleModoFiltro(modo: "mes" | "periodo") {
    setModoFiltro(modo);
    if (modo === "mes") {
      startTransition(async () => {
        const novosPagamentos = await getPagamentosAvulsos(ano, mes);
        setPagamentos(novosPagamentos);
      });
    }
  }

  function handleAplicarPeriodo() {
    if (!periodoInicio || !periodoFim) return;
    startTransition(async () => {
      const novosPagamentos = await getPagamentosAvulsos(ano, mes, periodoInicio, periodoFim);
      setPagamentos(novosPagamentos);
    });
  }

  const pagamentosFiltrados = useMemo(() => {
    if (categoriaFiltro === CATEGORIA_FILTRO_TODAS) return pagamentos;
    return pagamentos.filter((pagamento) => {
      if (pagamento.categoria_id === categoriaFiltro) return true;
      // Registro histórico (sem categoria_id) — casa pelo nome, já que a
      // migration semeia categorias_avulsos com os mesmos nomes do enum
      // fixo antigo (ver 20260901100000_categorias_financeiro.sql).
      const categoriaSelecionada = categoriaPorId.get(categoriaFiltro);
      if (!categoriaSelecionada || pagamento.categoria_id) return false;
      return PAGAMENTO_AVULSO_TIPO_LABELS[pagamento.tipo] === categoriaSelecionada.nome;
    });
  }, [pagamentos, categoriaFiltro, categoriaPorId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex w-fit items-center gap-1 rounded-md border p-0.5">
            <Button
              type="button"
              variant={modoFiltro === "mes" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModoFiltro("mes")}
            >
              Por mês
            </Button>
            <Button
              type="button"
              variant={modoFiltro === "periodo" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleModoFiltro("periodo")}
            >
              Por período
            </Button>
          </div>

          {modoFiltro === "mes" ? (
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
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="periodo_inicio_avulso" className="text-xs">
                  De:
                </Label>
                <Input
                  id="periodo_inicio_avulso"
                  type="date"
                  value={periodoInicio}
                  onChange={(event) => setPeriodoInicio(event.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="periodo_fim_avulso" className="text-xs">
                  Até:
                </Label>
                <Input
                  id="periodo_fim_avulso"
                  type="date"
                  value={periodoFim}
                  onChange={(event) => setPeriodoFim(event.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAplicarPeriodo}
                disabled={isPending || !periodoInicio || !periodoFim}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>
        <NovoPagamentoDialog alunos={alunos} categorias={categorias} onCriado={recarregar} />
      </div>

      <Select
        items={categoriaFiltroItems}
        value={categoriaFiltro}
        onValueChange={(value) => setCategoriaFiltro(value as string)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(categoriaFiltroItems).map((categoriaId) => (
            <SelectItem key={categoriaId} value={categoriaId}>
              {categoriaFiltroItems[categoriaId]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pagamentosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {modoFiltro === "periodo" && periodoInicio && periodoFim
            ? `Nenhum pagamento avulso registrado entre ${formatDataBR(periodoInicio)} e ${formatDataBR(periodoFim)}.`
            : `Nenhum pagamento avulso registrado em ${NOMES_MES[mes - 1]} de ${ano}.`}
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
                  <CategoriaBadge pagamento={pagamento} categoriaPorId={categoriaPorId} />
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
