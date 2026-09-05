"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  atualizarStatusChamado,
  createManutencaoChamado,
  deleteManutencaoChamado,
  getManutencaoChamados,
  resolverChamado,
} from "@/app/admin/manutencao/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  MANUTENCAO_PRIORIDADES,
  MANUTENCAO_PRIORIDADE_BADGE_CLASS,
  MANUTENCAO_PRIORIDADE_LABELS,
  MANUTENCAO_STATUS_BADGE_CLASS,
  MANUTENCAO_STATUS_LABELS,
  MANUTENCAO_STATUSES_ENCERRADOS,
  type ManutencaoChamado,
} from "@/lib/manutencao/schema";

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...MANUTENCAO_STATUS_LABELS,
};

const PRIORIDADE_FILTRO_TODAS = "todas";
const PRIORIDADE_FILTRO_ITEMS: Record<string, string> = {
  [PRIORIDADE_FILTRO_TODAS]: "Todas as prioridades",
  ...MANUTENCAO_PRIORIDADE_LABELS,
};

function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function NovoChamadoDialog({ onCriado }: { onCriado: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await createManutencaoChamado(formData);
      if (resultado.error) {
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
            Novo chamado
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo chamado</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" rows={3} placeholder="Opcional" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="local">Local</Label>
            <Input id="local" name="local" placeholder="Opcional" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prioridade">Prioridade</Label>
            <Select name="prioridade" items={MANUTENCAO_PRIORIDADE_LABELS} defaultValue="media">
              <SelectTrigger id="prioridade" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUTENCAO_PRIORIDADES.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {MANUTENCAO_PRIORIDADE_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Registrar chamado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolverChamadoDialog({
  chamado,
  onResolvido,
}: {
  chamado: ManutencaoChamado;
  onResolvido: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await resolverChamado(chamado.id, formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onResolvido();
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
      <DialogTrigger render={<Button variant="ghost" size="sm">Resolver</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolver chamado — {chamado.titulo}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes_resolucao">Como foi resolvido</Label>
            <Textarea id="observacoes_resolucao" name="observacoes_resolucao" rows={4} required />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Marcar como resolvido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AcoesChamado({ chamado, onMudou }: { chamado: ManutencaoChamado; onMudou: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);

  function handleEmAndamento() {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarStatusChamado(chamado.id, "em_andamento");
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onMudou();
    });
  }

  function handleCancelar() {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarStatusChamado(chamado.id, "cancelado");
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onMudou();
    });
  }

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await deleteManutencaoChamado(chamado.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setExcluirOpen(false);
      onMudou();
    });
  }

  const ativo = chamado.status === "aberto" || chamado.status === "em_andamento";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {chamado.status === "aberto" && (
          <Button variant="ghost" size="sm" disabled={isPending} onClick={handleEmAndamento}>
            Em andamento
          </Button>
        )}
        {ativo && <ResolverChamadoDialog chamado={chamado} onResolvido={onMudou} />}
        {ativo && (
          <Button variant="ghost" size="sm" disabled={isPending} onClick={handleCancelar}>
            Cancelar
          </Button>
        )}
        {MANUTENCAO_STATUSES_ENCERRADOS.includes(chamado.status) && (
          <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm">Excluir</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir chamado</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir &quot;{chamado.titulo}&quot;? Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
                  {isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

export function ManutencaoView({
  chamadosIniciais,
  totalInicial,
  paginaInicial,
  limiteInicial,
  queryInicial,
}: {
  chamadosIniciais: ManutencaoChamado[];
  totalInicial: number;
  paginaInicial: number;
  limiteInicial: number;
  queryInicial: string;
}) {
  const router = useRouter();
  const [chamados, setChamados] = useState(chamadosIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(paginaInicial);
  const [limite, setLimite] = useState(limiteInicial);
  const [busca, setBusca] = useState(queryInicial);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>(PRIORIDADE_FILTRO_TODAS);

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (valor.trim()) params.set("q", valor.trim());
      if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
      const query = params.toString();
      router.push(query ? `/admin/manutencao?${query}` : "/admin/manutencao");
    }, 500);
  }

  async function recarregar(novaPagina: number, novoLimite: number) {
    const resultado = await getManutencaoChamados({
      query: busca.trim() || undefined,
      page: novaPagina,
      limit: novoLimite,
    });
    setChamados(resultado.chamados);
    setTotal(resultado.total);
    setPagina(novaPagina);
    setLimite(novoLimite);
  }

  function handlePaginar(novaPagina: number, novoLimite: number) {
    startTransition(async () => {
      await recarregar(novaPagina, novoLimite);
    });
  }

  function handleMudou() {
    startTransition(async () => {
      await recarregar(pagina, limite);
    });
  }

  // Chamado novo aparece no topo (lista ordenada por created_at desc) —
  // volta pra página 1 pra ele aparecer, mesmo padrão de
  // recarregarDoInicio em gastos-view.tsx.
  function handleCriado() {
    startTransition(async () => {
      await recarregar(1, limite);
    });
  }

  const chamadosFiltrados = useMemo(() => {
    return chamados.filter((chamado) => {
      if (statusFiltro !== STATUS_FILTRO_TODOS && chamado.status !== statusFiltro) return false;
      if (prioridadeFiltro !== PRIORIDADE_FILTRO_TODAS && chamado.prioridade !== prioridadeFiltro) return false;
      return true;
    });
  }, [chamados, statusFiltro, prioridadeFiltro]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Buscar chamado..."
            value={busca}
            onChange={(event) => handleBuscaChange(event.target.value)}
            className="max-w-sm"
          />
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
            items={PRIORIDADE_FILTRO_ITEMS}
            value={prioridadeFiltro}
            onValueChange={(value) => setPrioridadeFiltro(value as string)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PRIORIDADE_FILTRO_ITEMS).map((prioridade) => (
                <SelectItem key={prioridade} value={prioridade}>
                  {PRIORIDADE_FILTRO_ITEMS[prioridade]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NovoChamadoDialog onCriado={handleCriado} />
      </div>

      {chamadosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {chamados.length === 0 && !busca
            ? "Nenhum chamado registrado ainda."
            : "Nenhum chamado encontrado com os filtros aplicados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chamadosFiltrados.map((chamado) => (
              <TableRow key={chamado.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{chamado.titulo}</span>
                    {chamado.descricao && (
                      <span className="text-muted-foreground text-xs">{chamado.descricao}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{chamado.local ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={MANUTENCAO_PRIORIDADE_BADGE_CLASS[chamado.prioridade]}>
                    {MANUTENCAO_PRIORIDADE_LABELS[chamado.prioridade]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={MANUTENCAO_STATUS_BADGE_CLASS[chamado.status]}>
                    {MANUTENCAO_STATUS_LABELS[chamado.status]}
                  </Badge>
                </TableCell>
                <TableCell>{formatDataHora(chamado.created_at)}</TableCell>
                <TableCell className="text-right">
                  <AcoesChamado chamado={chamado} onMudou={handleMudou} />
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
