"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { atualizarObservacaoEntrega, excluirEntrega } from "@/app/admin/estoque/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Paginacao } from "@/components/ui/paginacao";
import { LIMITE_PADRAO } from "@/lib/paginacao";
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
  type EstoqueCategoria,
  type EstoqueEntrega,
} from "@/lib/estoque/schema";

const CATEGORIA_FILTRO_TODAS = "todas";
const CATEGORIA_FILTRO_ITEMS: Record<string, string> = {
  [CATEGORIA_FILTRO_TODAS]: "Todas as categorias",
  ...ESTOQUE_CATEGORIA_LABELS,
};

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

function EditarObservacaoDialog({
  entrega,
  onSalvo,
}: {
  entrega: EstoqueEntrega;
  onSalvo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState(entrega.motivo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setMotivo(entrega.motivo ?? "");
      setError(null);
    }
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarObservacaoEntrega(entrega.id, motivo);
      if (resultado.error) {
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
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar observação">
            <Pencil />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar observação</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`motivo-${entrega.id}`}>Motivo / Observação</Label>
            <Textarea
              id={`motivo-${entrega.id}`}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirEntregaButton({
  entrega,
  onExcluido,
}: {
  entrega: EstoqueEntrega;
  onExcluido: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirEntrega(entrega.id);
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
            aria-label="Excluir entrega"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir registro de entrega</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este registro de entrega de &quot;
            {entrega.estoque_itens?.nome ?? "item"}&quot;? Esta ação não pode ser desfeita e não repõe
            a quantidade no estoque.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${entrega.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${entrega.id}`}
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

export function EstoqueEntregasView({
  entregas,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  limite,
  query,
}: {
  entregas: EstoqueEntrega[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limite: number;
  query: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(query);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(CATEGORIA_FILTRO_TODAS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (valor.trim()) params.set("q", valor.trim());
      if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
      const queryString = params.toString();
      router.push(queryString ? `/admin/estoque/entregas?${queryString}` : "/admin/estoque/entregas");
    }, 500);
  }

  function handleMudou() {
    router.refresh();
  }

  // Filtro de categoria do item: só na página já carregada (não faz parte
  // do searchParams de getEstoqueEntregas), mesmo padrão do filtro de
  // status em fornecedores-view.tsx.
  const entregasFiltradas = useMemo(() => {
    return entregas.filter((entrega) => {
      if (categoriaFiltro === CATEGORIA_FILTRO_TODAS) return true;
      return entrega.estoque_itens?.categoria === (categoriaFiltro as EstoqueCategoria);
    });
  }, [entregas, categoriaFiltro]);

  const paginacaoSearchParams: Record<string, string> = {};
  if (query) paginacaoSearchParams.q = query;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por aluno ou item..."
          value={busca}
          onChange={(event) => handleBuscaChange(event.target.value)}
          className="max-w-sm"
        />
        <Select
          items={CATEGORIA_FILTRO_ITEMS}
          value={categoriaFiltro}
          onValueChange={(value) => setCategoriaFiltro(value as string)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(CATEGORIA_FILTRO_ITEMS).map((chave) => (
              <SelectItem key={chave} value={chave}>
                {CATEGORIA_FILTRO_ITEMS[chave]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entregasFiltradas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {totalRegistros === 0
            ? "Nenhuma entrega registrada ainda."
            : "Nenhuma entrega encontrada com os filtros aplicados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Aluno</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Motivo/Observação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entregasFiltradas.map((entrega) => (
              <TableRow key={entrega.id}>
                <TableCell>{formatDataHora(entrega.created_at)}</TableCell>
                <TableCell className="font-medium">{entrega.aluno_nome_cache ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span>{entrega.estoque_itens?.nome ?? "—"}</span>
                    {entrega.estoque_itens && (
                      <Badge className={ESTOQUE_CATEGORIA_BADGE_CLASS[entrega.estoque_itens.categoria]}>
                        {ESTOQUE_CATEGORIA_LABELS[entrega.estoque_itens.categoria]}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{entrega.quantidade}</TableCell>
                <TableCell className="text-muted-foreground">{entrega.motivo ?? "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <EditarObservacaoDialog entrega={entrega} onSalvo={handleMudou} />
                  <ExcluirEntregaButton entrega={entrega} onExcluido={handleMudou} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/estoque/entregas"
        searchParams={paginacaoSearchParams}
      />
    </div>
  );
}
