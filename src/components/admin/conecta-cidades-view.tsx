"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  adicionarCidade,
  excluirCidade,
  getCidadesAdmin,
  toggleCidadeAtiva,
} from "@/app/admin/conecta/cidades/actions";
import {
  CIDADE_ESTADO_BADGE_CLASS,
  CIDADE_ESTADO_LABELS,
  CIDADE_ESTADOS,
  type CidadeConecta,
  type CidadeEstado,
} from "@/lib/conecta/schema";
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

// Sergipe antes de Alagoas (mesma ordem já usada no seed/agrupamento
// anterior) — não é ordem alfabética de estado, por isso um mapa fixo em
// vez de localeCompare direto em cidade.estado.
const ESTADO_ORDEM: Record<CidadeEstado, number> = { SE: 0, AL: 1 };

const ESTADO_FILTRO_TODOS = "todos";
const ESTADO_FILTRO_ITEMS: Record<string, string> = {
  [ESTADO_FILTRO_TODOS]: "Todos",
  ...Object.fromEntries(CIDADE_ESTADOS.map((estado) => [estado, `${CIDADE_ESTADO_LABELS[estado]} (${estado})`])),
};

const ESTADO_ITEMS = Object.fromEntries(CIDADE_ESTADOS.map((estado) => [estado, CIDADE_ESTADO_LABELS[estado]]));

function AdicionarCidadeDialog({ onAdicionada }: { onAdicionada: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState<CidadeEstado>("SE");
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
      setEstado("SE");
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
            <Select items={ESTADO_ITEMS} value={estado} onValueChange={(value) => setEstado((value as CidadeEstado) || "SE")}>
              <SelectTrigger id="estado-cidade" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CIDADE_ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {CIDADE_ESTADO_LABELS[uf]}
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
        </div>
        <DialogFooter>
          <Button type="button" disabled={isPending || !nome.trim()} onClick={handleSalvar}>
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

  // Busca e filtro são 100% client-side (REGRA da tarefa) — a lista
  // completa já vem carregada de getCidadesAdmin, sem paginação no banco.
  const cidadesFiltradas = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase();
    return cidades
      .filter((cidade) => {
        if (estadoFiltro !== ESTADO_FILTRO_TODOS && cidade.estado !== estadoFiltro) return false;
        if (termo && !cidade.nome.toLowerCase().includes(termo)) return false;
        return true;
      })
      .sort((a, b) => ESTADO_ORDEM[a.estado] - ESTADO_ORDEM[b.estado] || a.nome.localeCompare(b.nome, "pt-BR"));
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
          <Select items={ESTADO_FILTRO_ITEMS} value={estadoFiltro} onValueChange={(v) => handleEstadoChange(v ?? ESTADO_FILTRO_TODOS)}>
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
        </div>
        <AdicionarCidadeDialog onAdicionada={recarregar} />
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
                  <Badge className={CIDADE_ESTADO_BADGE_CLASS[cidade.estado]}>{cidade.estado}</Badge>
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
