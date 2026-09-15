"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  adicionarCidade,
  ativarCidadesPorEstado,
  ativarTodasCidades,
  desativarCidadesPorEstado,
  desativarTodasCidades,
  excluirCidade,
  getCidadesAdmin,
  toggleCidadeAtiva,
} from "@/app/admin/conecta/cidades/actions";
import { CIDADE_ESTADO_BADGE_CLASS, CIDADE_ESTADO_LABELS, type CidadeConecta, type CidadeEstado } from "@/lib/conecta/schema";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paginacao } from "@/components/ui/paginacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LIMITE = 20;

// Sergipe antes de Alagoas (mesma ordem já usada no seed original); estados
// fora desses dois (cadastrados via TAREFA 2) caem depois, em ordem
// alfabética entre si.
const ESTADO_ORDEM: Record<string, number> = { SE: 0, AL: 1 };

function labelEstado(estado: string): string {
  return CIDADE_ESTADO_LABELS[estado as CidadeEstado] ?? estado;
}

function corBadgeEstado(estado: string): string {
  return CIDADE_ESTADO_BADGE_CLASS[estado as CidadeEstado] ?? "bg-muted text-muted-foreground";
}

const ESTADO_FILTRO_TODOS = "todos";

function AdicionarCidadeDialog({ onAdicionada }: { onAdicionada: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSalvar() {
    setError(null);
    startTransition(async () => {
      const resultado = await adicionarCidade(nome, estado);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setNome("");
      setEstado("");
      setOpen(false);
      onAdicionada();
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
          <Button type="button">
            <Plus className="size-4" />
            Adicionar cidade
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar cidade</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome-cidade">Nome da cidade</Label>
            <Input id="nome-cidade" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado-cidade">Estado</Label>
            <Input
              id="estado-cidade"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Ex: SE, AL, PE, BA..."
              maxLength={2}
              className="w-24 uppercase"
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" disabled={isPending || !nome.trim() || estado.length !== 2} onClick={handleSalvar}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleAtivaSwitch({ cidade, onAtualizada }: { cidade: CidadeConecta; onAtualizada: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(valor: boolean) {
    startTransition(async () => {
      await toggleCidadeAtiva(cidade.id, valor);
      onAtualizada();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={cidade.ativa} onCheckedChange={handleChange} disabled={isPending} />
      <span className="text-muted-foreground text-xs">{cidade.ativa ? "Ativa" : "Inativa"}</span>
    </div>
  );
}

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function ExcluirCidadeButton({ cidade, onExcluida }: { cidade: CidadeConecta; onExcluida: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirCidade(cidade.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onExcluida();
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
          <Button type="button" variant="ghost" size="sm" className="text-destructive" title="Excluir cidade">
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cidade</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{cidade.nome}&quot;? Vagas já cadastradas nessa cidade não são
            afetadas, mas ela deixa de aparecer nas opções para novas vagas. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-cidade-${cidade.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-cidade-${cidade.id}`}
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

function AtivarTodasButton({ onAtualizado }: { onAtualizado: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const resultado = await ativarTodasCidades();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onAtualizado();
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
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" className="text-green-600 dark:text-green-400">
            ✅ Ativar todas
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ativar todas as cidades</AlertDialogTitle>
          <AlertDialogDescription>Tem certeza que deseja ativar todas as cidades?</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleConfirmar}>
            {isPending ? "Ativando..." : "Ativar todas"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DesativarTodasButton({ onAtualizado }: { onAtualizado: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const resultado = await desativarTodasCidades();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onAtualizado();
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
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" className="text-destructive">
            🔴 Desativar todas
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar todas as cidades</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desativar todas as cidades? Empresas não conseguirão cadastrar novas vagas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirmar}>
            {isPending ? "Desativando..." : "Desativar todas"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AtivarEstadoButton({ estado, onAtualizado }: { estado: string; onAtualizado: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const resultado = await ativarCidadesPorEstado(estado);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onAtualizado();
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
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="text-green-600 dark:text-green-400">
            ✅ Ativar todas de {estado}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ativar todas as cidades de {labelEstado(estado)}</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja ativar todas as cidades de {labelEstado(estado)} ({estado})?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleConfirmar}>
            {isPending ? "Ativando..." : "Ativar todas"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DesativarEstadoButton({ estado, onAtualizado }: { estado: string; onAtualizado: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const resultado = await desativarCidadesPorEstado(estado);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onAtualizado();
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
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="text-destructive">
            🔴 Desativar todas de {estado}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar todas as cidades de {labelEstado(estado)}</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desativar todas as cidades de {labelEstado(estado)} ({estado})? Empresas não
            conseguirão cadastrar novas vagas nessas cidades.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirmar}>
            {isPending ? "Desativando..." : "Desativar todas"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConectaCidadesView({ cidadesIniciais }: { cidadesIniciais: CidadeConecta[] }) {
  const [cidades, setCidades] = useState(cidadesIniciais);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState(ESTADO_FILTRO_TODOS);
  const [pagina, setPagina] = useState(1);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function recarregar() {
    startTransition(async () => {
      const atualizado = await getCidadesAdmin();
      setCidades(atualizado);
    });
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscaDebounced(valor);
      setPagina(1);
    }, 300);
  }

  function handleEstadoChange(valor: string) {
    setEstadoFiltro(valor);
    setPagina(1);
  }

  // Dinâmico a partir das cidades já carregadas (TAREFA 2) — em vez de uma
  // segunda chamada a getEstadosDisponiveis, que traria exatamente a mesma
  // informação já presente em `cidades`; fica sincronizado automaticamente
  // sempre que a lista muda (ex.: logo após adicionar a 1ª cidade de um
  // estado novo), sem round-trip extra.
  const estadosDisponiveis = useMemo(
    () => [...new Set(cidades.map((cidade) => cidade.estado))].sort((a, b) => a.localeCompare(b)),
    [cidades],
  );
  const ESTADO_FILTRO_ITEMS: Record<string, string> = {
    [ESTADO_FILTRO_TODOS]: "Todos",
    ...Object.fromEntries(estadosDisponiveis.map((estado) => [estado, `${labelEstado(estado)} (${estado})`])),
  };

  const cidadesFiltradas = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase();
    return cidades
      .filter((cidade) => {
        if (estadoFiltro !== ESTADO_FILTRO_TODOS && cidade.estado !== estadoFiltro) return false;
        if (termo && !cidade.nome.toLowerCase().includes(termo)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (ESTADO_ORDEM[a.estado] ?? 99) - (ESTADO_ORDEM[b.estado] ?? 99) ||
          a.estado.localeCompare(b.estado) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      );
  }, [cidades, buscaDebounced, estadoFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(cidadesFiltradas.length / LIMITE));
  const offset = (pagina - 1) * LIMITE;
  const cidadesPagina = cidadesFiltradas.slice(offset, offset + LIMITE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={busca}
            onChange={(e) => handleBuscaChange(e.target.value)}
            placeholder="Buscar por nome da cidade..."
            className="max-w-sm"
          />
          <Select
            items={ESTADO_FILTRO_ITEMS}
            value={estadoFiltro}
            onValueChange={(v) => handleEstadoChange(v ?? ESTADO_FILTRO_TODOS)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ESTADO_FILTRO_ITEMS).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {estadoFiltro !== ESTADO_FILTRO_TODOS && (
            <>
              <AtivarEstadoButton estado={estadoFiltro} onAtualizado={recarregar} />
              <DesativarEstadoButton estado={estadoFiltro} onAtualizado={recarregar} />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AtivarTodasButton onAtualizado={recarregar} />
          <DesativarTodasButton onAtualizado={recarregar} />
          <AdicionarCidadeDialog onAdicionada={recarregar} />
        </div>
      </div>

      {cidadesFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {cidades.length === 0 ? "Nenhuma cidade cadastrada." : "Nenhuma cidade encontrada com os filtros aplicados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cidade</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Excluir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cidadesPagina.map((cidade) => (
              <TableRow key={cidade.id}>
                <TableCell className="font-medium">{cidade.nome}</TableCell>
                <TableCell>
                  <Badge className={corBadgeEstado(cidade.estado)}>{cidade.estado}</Badge>
                </TableCell>
                <TableCell>
                  <ToggleAtivaSwitch cidade={cidade} onAtualizada={recarregar} />
                </TableCell>
                <TableCell className="text-right">
                  <ExcluirCidadeButton cidade={cidade} onExcluida={recarregar} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Paginacao
        paginaAtual={pagina}
        totalPaginas={totalPaginas}
        totalRegistros={cidadesFiltradas.length}
        limite={LIMITE}
        onNavigate={(novaPagina) => setPagina(novaPagina)}
      />
    </div>
  );
}
