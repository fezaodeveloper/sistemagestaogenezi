"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Plus } from "lucide-react";
import {
  buscarAlunosParaEntrega,
  deleteEstoqueItem,
  getEstoqueItens,
  registrarMovimentacao,
} from "@/app/admin/estoque/actions";
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
import {
  ESTOQUE_CATEGORIA_BADGE_CLASS,
  ESTOQUE_CATEGORIA_LABELS,
  ESTOQUE_MOVIMENTACAO_TIPOS,
  ESTOQUE_MOVIMENTACAO_TIPO_LABELS,
  type EstoqueItem,
  type EstoqueMovimentacaoTipo,
} from "@/lib/estoque/schema";

function MovimentacaoDialog({
  item,
  tipoInicial,
  onRegistrado,
}: {
  item: EstoqueItem;
  tipoInicial: EstoqueMovimentacaoTipo;
  onRegistrado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>(tipoInicial);
  const [isPending, startTransition] = useTransition();
  const [buscaAluno, setBuscaAluno] = useState("");
  const [alunoSelecionado, setAlunoSelecionado] = useState<{
    id: string;
    full_name: string | null;
  } | null>(null);
  const [resultadosAluno, setResultadosAluno] = useState<{ id: string; full_name: string | null }[]>(
    [],
  );
  const [buscandoAluno, setBuscandoAluno] = useState(false);

  // Busca sob demanda com debounce de 300ms — só dispara com 2+ caracteres,
  // mesmo padrão de buscarAlunosParaWizard (matricula-wizard.tsx).
  useEffect(() => {
    const termo = buscaAluno.trim();

    const timeoutId = setTimeout(() => {
      if (termo.length < 2) {
        setResultadosAluno([]);
        setBuscandoAluno(false);
        return;
      }

      setBuscandoAluno(true);
      buscarAlunosParaEntrega(termo)
        .then((resultado) => setResultadosAluno(resultado))
        .finally(() => setBuscandoAluno(false));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [buscaAluno]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await registrarMovimentacao(item.id, formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onRegistrado();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setError(null);
          setTipo(tipoInicial);
          setBuscaAluno("");
          setAlunoSelecionado(null);
          setResultadosAluno([]);
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm">{ESTOQUE_MOVIMENTACAO_TIPO_LABELS[tipoInicial]}</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar estoque — {item.nome}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              name="tipo"
              items={ESTOQUE_MOVIMENTACAO_TIPO_LABELS}
              value={tipo}
              onValueChange={(value) => setTipo(value as string)}
            >
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTOQUE_MOVIMENTACAO_TIPOS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {ESTOQUE_MOVIMENTACAO_TIPO_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quantidade">
              {tipo === "ajuste" ? "Nova quantidade em estoque" : "Quantidade"}
            </Label>
            <Input id="quantidade" name="quantidade" type="number" min={0} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Input id="motivo" name="motivo" placeholder="Opcional" />
          </div>
          {tipo === "saida" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="busca_aluno">Aluno (opcional)</Label>
              <input type="hidden" name="aluno_id" value={alunoSelecionado?.id ?? ""} />
              <input
                type="hidden"
                name="aluno_nome_cache"
                value={alunoSelecionado?.full_name ?? ""}
              />
              {alunoSelecionado ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{alunoSelecionado.full_name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAlunoSelecionado(null)}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="busca_aluno"
                    placeholder="Nome do aluno..."
                    value={buscaAluno}
                    onChange={(event) => setBuscaAluno(event.target.value)}
                  />
                  {buscaAluno.trim().length >= 2 && (
                    <div className="flex max-h-40 flex-col overflow-y-auto rounded-md border">
                      {buscandoAluno ? (
                        <p className="text-muted-foreground p-2 text-center text-xs">Buscando...</p>
                      ) : resultadosAluno.length === 0 ? (
                        <p className="text-muted-foreground p-2 text-center text-xs">
                          Nenhum aluno encontrado.
                        </p>
                      ) : (
                        resultadosAluno.map((candidato) => (
                          <button
                            key={candidato.id}
                            type="button"
                            onClick={() => {
                              setAlunoSelecionado(candidato);
                              setBuscaAluno("");
                              setResultadosAluno([]);
                            }}
                            className="hover:bg-accent px-3 py-2 text-left text-sm"
                          >
                            {candidato.full_name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirItemButton({ item, onExcluido }: { item: EstoqueItem; onExcluido: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await deleteEstoqueItem(item.id);
      if (resultado.error) {
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
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="sm">Excluir</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir item</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{item.nome}&quot;? Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EstoqueView({
  itensIniciais,
  totalInicial,
  paginaInicial,
  limiteInicial,
  queryInicial,
}: {
  itensIniciais: EstoqueItem[];
  totalInicial: number;
  paginaInicial: number;
  limiteInicial: number;
  queryInicial: string;
}) {
  const router = useRouter();
  const [itens, setItens] = useState(itensIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(paginaInicial);
  const [limite, setLimite] = useState(limiteInicial);
  const [busca, setBusca] = useState(queryInicial);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (valor.trim()) params.set("q", valor.trim());
      if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
      const query = params.toString();
      router.push(query ? `/admin/estoque?${query}` : "/admin/estoque");
    }, 500);
  }

  // Paginação client-side via Server Action (mesmo padrão de
  // gastos/avulsos) — não passa pela URL, por isso não conflita com a busca
  // acima, que é a única coisa refletida em searchParams.
  function handlePaginar(novaPagina: number, novoLimite: number) {
    startTransition(async () => {
      const resultado = await getEstoqueItens({
        query: busca.trim() || undefined,
        page: novaPagina,
        limit: novoLimite,
      });
      setItens(resultado.itens);
      setTotal(resultado.total);
      setPagina(novaPagina);
      setLimite(novoLimite);
    });
  }

  // Recarrega a página atual (usado após excluir ou registrar uma
  // movimentação de estoque — nenhum dos dois muda o total de páginas o
  // suficiente pra justificar voltar pra página 1).
  function handleAtualizado() {
    startTransition(async () => {
      const resultado = await getEstoqueItens({
        query: busca.trim() || undefined,
        page: pagina,
        limit: limite,
      });
      setItens(resultado.itens);
      setTotal(resultado.total);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input
          placeholder="Buscar item..."
          value={busca}
          onChange={(event) => handleBuscaChange(event.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Button render={<Link href="/admin/estoque/entregas" />} nativeButton={false} variant="outline">
            Ver entregas
            <ArrowRight />
          </Button>
          <Button render={<Link href="/admin/estoque/novo" />} nativeButton={false}>
            <Plus />
            Novo item
          </Button>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {busca
            ? "Nenhum item encontrado com os filtros aplicados."
            : "Nenhum item cadastrado ainda."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Qtd. atual</TableHead>
              <TableHead>Qtd. mínima</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => {
              const baixo = item.quantidade_atual < item.quantidade_minima;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.nome}
                    <span className="text-muted-foreground ml-1 text-xs">({item.unidade})</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={ESTOQUE_CATEGORIA_BADGE_CLASS[item.categoria]}>
                      {ESTOQUE_CATEGORIA_LABELS[item.categoria]}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.quantidade_atual}</TableCell>
                  <TableCell>{item.quantidade_minima}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        baixo
                          ? "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                          : "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                      }
                    >
                      {baixo ? "Baixo" : "OK"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex flex-wrap justify-end gap-1">
                    <MovimentacaoDialog item={item} tipoInicial="entrada" onRegistrado={handleAtualizado} />
                    <MovimentacaoDialog item={item} tipoInicial="saida" onRegistrado={handleAtualizado} />
                    <Button
                      render={<Link href={`/admin/estoque/${item.id}/editar`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <ExcluirItemButton item={item} onExcluido={handleAtualizado} />
                  </TableCell>
                </TableRow>
              );
            })}
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
