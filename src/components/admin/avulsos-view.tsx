"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  atualizarPagamentoAvulso,
  buscarAlunosParaAvulso,
  criarPagamentoAvulso,
  excluirPagamentoAvulso,
  getPagamentosAvulsos,
  type AlunoOpcao,
  type PagamentoAvulsoComAluno,
} from "@/app/admin/financeiro/avulsos/actions";
import type { Categoria } from "@/app/admin/financeiro/categorias/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LIMITE_PADRAO, calcularTotalPaginas } from "@/lib/paginacao";
import { FORMAS_PAGAMENTO_AVULSO, FORMA_PAGAMENTO_AVULSO_LABELS, PAGAMENTO_AVULSO_TIPO_LABELS } from "@/lib/financeiro/schema";

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CATEGORIA_FILTRO_TODAS = "todas";

// Mesmo padrão de toggle Eye/EyeOff + localStorage de
// dashboard-kpis-financeiros.tsx — chave própria por tela.
const KPIS_VISIVEL_STORAGE_KEY = "genezi-avulsos-kpis-visivel";
const VALOR_OCULTO = "R$ ••••";

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

// Busca sob demanda de aluno (Etapa "Aluno vinculado") — substitui o Select
// com a lista inteira de alunos. Recebe uma key diferente a cada abertura
// do dialog pai (ver `key={open ...}` em Novo/EditarPagamentoDialog) pra
// remontar do zero e reler alunoIdInicial/nomeInicial, mesmo efeito do
// handleOpenChange que já reseta categoriaId nesses dialogs.
function AlunoBuscaAvulso({
  alunoIdInicial,
  nomeInicial,
}: {
  alunoIdInicial: string | null;
  nomeInicial: string | null;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<AlunoOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string } | null>(
    alunoIdInicial ? { id: alunoIdInicial, nome: nomeInicial ?? "—" } : null,
  );

  useEffect(() => {
    const termo = busca.trim();

    const timeoutId = setTimeout(() => {
      if (termo.length < 2) {
        setResultados([]);
        setBuscando(false);
        return;
      }

      setBuscando(true);
      buscarAlunosParaAvulso(termo)
        .then((resultado) => setResultados(resultado))
        .finally(() => setBuscando(false));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [busca]);

  function handleSelecionar(aluno: AlunoOpcao) {
    setSelecionado({ id: aluno.id, nome: aluno.full_name ?? "—" });
    setBusca("");
    setResultados([]);
  }

  function handleLimpar() {
    setSelecionado(null);
    setBusca("");
    setResultados([]);
  }

  const termo = busca.trim();

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="aluno_id" value={selecionado?.id ?? ""} />

      {selecionado ? (
        <Badge variant="secondary" className="flex w-fit items-center gap-1.5 py-1.5 pr-1.5 pl-2.5">
          {selecionado.nome}
          <button
            type="button"
            onClick={handleLimpar}
            className="hover:bg-muted-foreground/20 rounded-full p-0.5"
            aria-label="Limpar aluno selecionado"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ) : (
        <>
          <Input placeholder="Buscar aluno..." value={busca} onChange={(event) => setBusca(event.target.value)} />
          {termo.length >= 2 && (
            <div className="flex max-h-48 flex-col overflow-y-auto rounded-md border">
              {buscando ? (
                <p className="text-muted-foreground p-3 text-center text-sm">Buscando...</p>
              ) : resultados.length === 0 ? (
                <p className="text-muted-foreground p-3 text-center text-sm">Nenhum aluno encontrado.</p>
              ) : (
                resultados.map((aluno) => (
                  <button
                    key={aluno.id}
                    type="button"
                    onClick={() => handleSelecionar(aluno)}
                    className="hover:bg-muted flex flex-col gap-0.5 border-b p-2 text-left text-sm last:border-b-0"
                  >
                    <span className="font-medium">{aluno.full_name ?? "—"}</span>
                    <span className="text-muted-foreground text-xs">{aluno.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Mesmos campos de NovoPagamentoDialog (sem "Tipo": esse campo é o enum fixo
// legado, substituído por categoria_id — formulários de criação/edição não
// o expõem mais, só telas de exibição de registros históricos usam
// PAGAMENTO_AVULSO_TIPO_LABELS como fallback, ver CategoriaBadge acima).
// Sem AlertDialog: edição não é destrutiva (REGRA da tarefa).
function EditarPagamentoDialog({
  pagamento,
  categorias,
  onSalvo,
}: {
  pagamento: PagamentoAvulsoComAluno;
  categorias: Categoria[];
  onSalvo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState(pagamento.categoria_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoriasAtivas = useMemo(() => categorias.filter((categoria) => categoria.ativo), [categorias]);
  const categoriaItems = Object.fromEntries(categoriasAtivas.map((categoria) => [categoria.id, categoria.nome]));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setCategoriaId(pagamento.categoria_id ?? "");
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarPagamentoAvulso(pagamento.id, formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar pagamento">
            <Pencil />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar pagamento avulso</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`descricao-${pagamento.id}`}>Descrição</Label>
            <Input id={`descricao-${pagamento.id}`} name="descricao" defaultValue={pagamento.descricao} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`categoria_id-${pagamento.id}`}>Categoria</Label>
              <Select
                name="categoria_id"
                items={categoriaItems}
                value={categoriaId}
                onValueChange={(value) => setCategoriaId(value as string)}
              >
                <SelectTrigger id={`categoria_id-${pagamento.id}`} className="w-full">
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
              <Label htmlFor={`valor-${pagamento.id}`}>Valor</Label>
              <Input
                id={`valor-${pagamento.id}`}
                name="valor"
                type="number"
                step="0.01"
                min={0.01}
                defaultValue={Number(pagamento.valor)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`data_pagamento-${pagamento.id}`}>Data do pagamento</Label>
            <Input
              id={`data_pagamento-${pagamento.id}`}
              name="data_pagamento"
              type="date"
              defaultValue={pagamento.data_pagamento}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`forma_pagamento-${pagamento.id}`}>Forma de pagamento</Label>
            <Select name="forma_pagamento" items={FORMA_PAGAMENTO_AVULSO_LABELS} defaultValue={pagamento.forma_pagamento ?? undefined}>
              <SelectTrigger id={`forma_pagamento-${pagamento.id}`} className="w-full">
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
            <Label>Aluno vinculado</Label>
            <AlunoBuscaAvulso
              key={String(open)}
              alunoIdInicial={pagamento.aluno_id}
              nomeInicial={pagamento.alunos?.full_name ?? null}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`observacoes-${pagamento.id}`}>Observações</Label>
            <Input
              id={`observacoes-${pagamento.id}`}
              name="observacoes"
              placeholder="Opcional"
              defaultValue={pagamento.observacoes ?? ""}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !categoriaId}>
              {isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function ExcluirPagamentoButton({
  pagamento,
  onExcluido,
}: {
  pagamento: PagamentoAvulsoComAluno;
  onExcluido: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirPagamentoAvulso(pagamento.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onExcluido();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setConfirmacao("");
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            aria-label="Excluir pagamento"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pagamento avulso</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{pagamento.descricao}&quot;? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${pagamento.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${pagamento.id}`}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Digite EXCLUIR para confirmar"
            autoComplete="off"
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || confirmacao !== TEXTO_CONFIRMACAO_EXCLUSAO}
            onClick={handleExcluir}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NovoPagamentoDialog({
  categorias,
  onCriado,
}: {
  categorias: Categoria[];
  onCriado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoriasAtivas = useMemo(() => categorias.filter((categoria) => categoria.ativo), [categorias]);
  const categoriaItems = Object.fromEntries(categoriasAtivas.map((categoria) => [categoria.id, categoria.nome]));

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
            <Label>Aluno vinculado</Label>
            <AlunoBuscaAvulso key={String(open)} alunoIdInicial={null} nomeInicial={null} />
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
  totalInicial,
  anoInicial,
  mesInicial,
  categorias,
}: {
  pagamentosIniciais: PagamentoAvulsoComAluno[];
  totalInicial: number;
  anoInicial: number;
  mesInicial: number;
  categorias: Categoria[];
}) {
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);
  const [pagamentos, setPagamentos] = useState(pagamentosIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(LIMITE_PADRAO);
  const [busca, setBusca] = useState("");
  const [isPending, startTransition] = useTransition();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(CATEGORIA_FILTRO_TODAS);
  const [modoFiltro, setModoFiltro] = useState<"mes" | "periodo">("mes");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [kpisVisiveis, setKpisVisiveis] = useState(true);
  const [kpisHydrated, setKpisHydrated] = useState(false);

  // Leitura de localStorage tem que ficar num efeito pós-montagem, não num
  // inicializador de useState — mesmo motivo já documentado em
  // dashboard-kpis-financeiros.tsx (evita hydration mismatch).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(KPIS_VISIVEL_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo !== null) setKpisVisiveis(salvo === "true");
    } catch {}
    setKpisHydrated(true);
  }, []);

  useEffect(() => {
    if (!kpisHydrated) return;
    try {
      localStorage.setItem(KPIS_VISIVEL_STORAGE_KEY, String(kpisVisiveis));
    } catch {}
  }, [kpisVisiveis, kpisHydrated]);

  const categoriaPorId = useMemo(() => new Map(categorias.map((categoria) => [categoria.id, categoria])), [categorias]);

  const categoriaFiltroItems: Record<string, string> = {
    [CATEGORIA_FILTRO_TODAS]: "Todas as categorias",
    ...Object.fromEntries(categorias.map((categoria) => [categoria.id, categoria.nome])),
  };

  // Mesmo racional de gastos-view.tsx: buscar() é usado só por
  // irParaMes/recarregar/handlePaginar, que não mudam modoFiltro nem
  // periodoInicio/Fim na mesma chamada. handleModoFiltro e
  // handleAplicarPeriodo têm lógica própria abaixo por esse motivo.
  function buscar(novoAno: number, novoMes: number, novaPagina: number, novoLimite: number) {
    startTransition(async () => {
      const resultado =
        modoFiltro === "periodo" && periodoInicio && periodoFim
          ? await getPagamentosAvulsos(novoAno, novoMes, periodoInicio, periodoFim, novaPagina, novoLimite)
          : await getPagamentosAvulsos(novoAno, novoMes, undefined, undefined, novaPagina, novoLimite);
      setAno(novoAno);
      setMes(novoMes);
      setPagina(novaPagina);
      setLimite(novoLimite);
      setPagamentos(resultado.itens);
      setTotal(resultado.total);
    });
  }

  function irParaMes(novoAno: number, novoMes: number) {
    buscar(novoAno, novoMes, 1, limite);
  }

  function recarregar() {
    buscar(ano, mes, pagina, limite);
  }

  function recarregarDoInicio() {
    buscar(ano, mes, 1, limite);
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
        const resultado = await getPagamentosAvulsos(ano, mes, undefined, undefined, 1, limite);
        setPagina(1);
        setPagamentos(resultado.itens);
        setTotal(resultado.total);
      });
    }
  }

  function handleAplicarPeriodo() {
    if (!periodoInicio || !periodoFim) return;
    startTransition(async () => {
      const resultado = await getPagamentosAvulsos(ano, mes, periodoInicio, periodoFim, 1, limite);
      setPagina(1);
      setPagamentos(resultado.itens);
      setTotal(resultado.total);
    });
  }

  function handlePaginar(novaPagina: number, novoLimite: number) {
    buscar(ano, mes, novaPagina, novoLimite);
  }

  function handleExcluido(id: string) {
    setPagamentos((prev) => prev.filter((pagamento) => pagamento.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  // Busca por descrição ou aluno: filtro client-side sobre os registros já
  // carregados (a página atual), combinando com o filtro de categoria —
  // mesma limitação (não busca fora da página carregada) das outras
  // tabelas paginadas do admin.
  const pagamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pagamentos.filter((pagamento) => {
      if (categoriaFiltro !== CATEGORIA_FILTRO_TODAS) {
        const combina =
          pagamento.categoria_id === categoriaFiltro ||
          // Registro histórico (sem categoria_id) — casa pelo nome, já que a
          // migration semeia categorias_avulsos com os mesmos nomes do enum
          // fixo antigo (ver 20260901100000_categorias_financeiro.sql).
          (!pagamento.categoria_id &&
            PAGAMENTO_AVULSO_TIPO_LABELS[pagamento.tipo] === categoriaPorId.get(categoriaFiltro)?.nome);
        if (!combina) return false;
      }
      if (!termo) return true;
      const descricao = pagamento.descricao.toLowerCase();
      const nomeAluno = (pagamento.alunos?.full_name ?? "").toLowerCase();
      return descricao.includes(termo) || nomeAluno.includes(termo);
    });
  }, [pagamentos, categoriaFiltro, categoriaPorId, busca]);

  // KPIs calculados client-side sobre os pagamentos já carregados (a
  // página atual, após os filtros de busca/categoria) — mesma limitação já
  // documentada nas outras tabelas paginadas do admin. "Status" pedido no
  // enunciado do card 1 (excluir cancelados) não existe como coluna em
  // pagamentos_avulsos — soma todos os carregados.
  const totalRecebido = useMemo(
    () => pagamentosFiltrados.reduce((soma, pagamento) => soma + Number(pagamento.valor), 0),
    [pagamentosFiltrados],
  );
  const maiorPagamento = useMemo(
    () => pagamentosFiltrados.reduce((maior, pagamento) => Math.max(maior, Number(pagamento.valor)), 0),
    [pagamentosFiltrados],
  );

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
        <NovoPagamentoDialog categorias={categorias} onCriado={recarregarDoInicio} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setKpisVisiveis((atual) => !atual)}>
            {kpisVisiveis ? <Eye /> : <EyeOff />}
            {kpisVisiveis ? "Ocultar valores" : "Mostrar valores"}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="gz-kpi gz-kpi-green">
            <CardContent className="flex flex-col gap-1.5 py-4">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Total recebido no mês
              </span>
              <span className="gz-num text-[22px]" style={{ color: "#2DD4A0" }}>
                {kpisVisiveis ? formatValor(totalRecebido) : VALOR_OCULTO}
              </span>
            </CardContent>
          </Card>
          <Card className="gz-kpi gz-kpi-blue">
            <CardContent className="flex flex-col gap-1.5 py-4">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Quantidade de pagamentos
              </span>
              <span className="gz-num text-[22px]" style={{ color: "#2196F3" }}>
                {pagamentosFiltrados.length}
              </span>
            </CardContent>
          </Card>
          <Card className="gz-kpi gz-kpi-amber">
            <CardContent className="flex flex-col gap-1.5 py-4">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Maior pagamento
              </span>
              <span className="gz-num text-[22px]" style={{ color: "#FFB020" }}>
                {kpisVisiveis ? formatValor(maiorPagamento) : VALOR_OCULTO}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por descrição ou aluno..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />
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
      </div>

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
              <TableHead className="text-right">Ações</TableHead>
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
                <TableCell className="flex justify-end gap-1">
                  <EditarPagamentoDialog
                    pagamento={pagamento}
                    categorias={categorias}
                    onSalvo={recarregar}
                  />
                  <ExcluirPagamentoButton pagamento={pagamento} onExcluido={() => handleExcluido(pagamento.id)} />
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
