"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { deleteTreinamento } from "@/app/admin/treinamentos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TREINAMENTO_CATEGORIA_BADGE_CLASS,
  TREINAMENTO_CATEGORIA_LABELS,
  TREINAMENTO_STATUS_BADGE_CLASS,
  TREINAMENTO_STATUS_LABELS,
  type Treinamento,
} from "@/lib/treinamentos/schema";

const CATEGORIA_FILTRO_TODAS = "todas";
const CATEGORIA_FILTRO_ITEMS: Record<string, string> = {
  [CATEGORIA_FILTRO_TODAS]: "Todas as categorias",
  ...TREINAMENTO_CATEGORIA_LABELS,
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos",
  ...TREINAMENTO_STATUS_LABELS,
};

function ExcluirTreinamentoButton({ treinamento }: { treinamento: Treinamento }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await deleteTreinamento(treinamento.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
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
          <AlertDialogTitle>Excluir treinamento</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{treinamento.titulo}&quot;? Essa ação não pode ser
            desfeita.
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

export function TreinamentosView({ treinamentos }: { treinamentos: Treinamento[] }) {
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(CATEGORIA_FILTRO_TODAS);
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);

  const treinamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return treinamentos.filter((treinamento) => {
      if (categoriaFiltro !== CATEGORIA_FILTRO_TODAS && treinamento.categoria !== categoriaFiltro) return false;
      if (statusFiltro !== STATUS_FILTRO_TODOS && treinamento.status !== statusFiltro) return false;
      if (!termo) return true;

      const titulo = treinamento.titulo.toLowerCase();
      const descricao = (treinamento.descricao ?? "").toLowerCase();
      return titulo.includes(termo) || descricao.includes(termo);
    });
  }, [treinamentos, busca, categoriaFiltro, statusFiltro]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Buscar por título ou descrição..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
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
              {Object.keys(CATEGORIA_FILTRO_ITEMS).map((categoria) => (
                <SelectItem key={categoria} value={categoria}>
                  {CATEGORIA_FILTRO_ITEMS[categoria]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={STATUS_FILTRO_ITEMS}
            value={statusFiltro}
            onValueChange={(value) => setStatusFiltro(value as string)}
          >
            <SelectTrigger className="w-40">
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
        </div>
        <Button render={<Link href="/admin/treinamentos/novo" />} nativeButton={false}>
          <Plus />
          Novo treinamento
        </Button>
      </div>

      {treinamentosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {treinamentos.length === 0
            ? "Nenhum treinamento cadastrado ainda."
            : "Nenhum treinamento encontrado com os filtros aplicados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {treinamentosFiltrados.map((treinamento) => (
              <TableRow key={treinamento.id}>
                <TableCell className="font-medium">{treinamento.titulo}</TableCell>
                <TableCell>
                  <Badge className={TREINAMENTO_CATEGORIA_BADGE_CLASS[treinamento.categoria]}>
                    {TREINAMENTO_CATEGORIA_LABELS[treinamento.categoria]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={TREINAMENTO_STATUS_BADGE_CLASS[treinamento.status]}>
                    {TREINAMENTO_STATUS_LABELS[treinamento.status]}
                  </Badge>
                </TableCell>
                <TableCell>{treinamento.ordem}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    render={<a href={treinamento.youtube_url} target="_blank" rel="noopener noreferrer" />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Assistir
                  </Button>
                  <Button
                    render={<Link href={`/admin/treinamentos/${treinamento.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <ExcluirTreinamentoButton treinamento={treinamento} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
