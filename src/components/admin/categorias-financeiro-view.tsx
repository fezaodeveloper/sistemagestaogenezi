"use client";

import { useState, useTransition, type ReactElement } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarCategoria,
  criarCategoria,
  excluirCategoria,
  getCategorias,
  reordenarCategoria,
  type Categoria,
} from "@/app/admin/financeiro/categorias/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabelaCategoria = "categorias_gastos" | "categorias_avulsos";

const COR_PADRAO = "#6B7280";

function CategoriaFormDialog({
  tabela,
  categoria,
  onSalva,
  trigger,
}: {
  tabela: TabelaCategoria;
  categoria?: Categoria;
  onSalva: () => void;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [cor, setCor] = useState(categoria?.cor ?? COR_PADRAO);
  const [ativo, setAtivo] = useState(categoria?.ativo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setNome(categoria?.nome ?? "");
      setCor(categoria?.cor ?? COR_PADRAO);
      setAtivo(categoria?.ativo ?? true);
      setError(null);
    }
  }

  function handleSalvar() {
    setError(null);
    startTransition(async () => {
      const resultado = categoria
        ? await atualizarCategoria(tabela, categoria.id, { nome, cor, ativo })
        : await criarCategoria(tabela, nome, cor);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalva();
    });
  }

  const idPrefixo = `${tabela}-${categoria?.id ?? "novo"}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`nome-${idPrefixo}`}>Nome</Label>
            <Input id={`nome-${idPrefixo}`} value={nome} onChange={(event) => setNome(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`cor-${idPrefixo}`}>Cor</Label>
            <Input
              id={`cor-${idPrefixo}`}
              type="color"
              value={cor}
              onChange={(event) => setCor(event.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
          {categoria && (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={`ativo-${idPrefixo}`} className="font-normal">
                Categoria ativa
              </Label>
              <Switch id={`ativo-${idPrefixo}`} checked={ativo} onCheckedChange={setAtivo} />
            </div>
          )}
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

function CategoriaLista({
  tabela,
  categoriasIniciais,
}: {
  tabela: TabelaCategoria;
  categoriasIniciais: Categoria[];
}) {
  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function recarregar() {
    startTransition(async () => {
      const atualizadas = await getCategorias(tabela);
      setCategorias(atualizadas);
    });
  }

  function handleReordenar(id: string, direcao: "cima" | "baixo") {
    setErro(null);
    startTransition(async () => {
      await reordenarCategoria(tabela, id, direcao);
      const atualizadas = await getCategorias(tabela);
      setCategorias(atualizadas);
    });
  }

  function handleExcluir(id: string) {
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirCategoria(tabela, id);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      const atualizadas = await getCategorias(tabela);
      setCategorias(atualizadas);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CategoriaFormDialog
          tabela={tabela}
          onSalva={recarregar}
          trigger={
            <Button size="sm">
              <Plus />
              Nova categoria
            </Button>
          }
        />
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {categorias.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Nenhuma categoria cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.map((categoria, index) => (
              <TableRow key={categoria.id}>
                <TableCell>
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: categoria.cor }}
                  />
                </TableCell>
                <TableCell>{categoria.nome}</TableCell>
                <TableCell>
                  <Badge variant={categoria.ativo ? "default" : "outline"}>
                    {categoria.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{categoria.ordem}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending || index === 0}
                    onClick={() => handleReordenar(categoria.id, "cima")}
                    aria-label="Mover para cima"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending || index === categorias.length - 1}
                    onClick={() => handleReordenar(categoria.id, "baixo")}
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown />
                  </Button>
                  <CategoriaFormDialog
                    tabela={tabela}
                    categoria={categoria}
                    onSalva={recarregar}
                    trigger={
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar categoria">
                        <Pencil />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir categoria">
                          <Trash2 />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir a categoria &quot;{categoria.nome}&quot;? Só é
                          possível excluir categorias sem registros vinculados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => handleExcluir(categoria.id)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function CategoriasFinanceiroView({
  categoriasGastosIniciais,
  categoriasAvulsosIniciais,
}: {
  categoriasGastosIniciais: Categoria[];
  categoriasAvulsosIniciais: Categoria[];
}) {
  return (
    <Tabs defaultValue="gastos">
      <TabsList>
        <TabsTrigger value="gastos">Categorias de Gastos</TabsTrigger>
        <TabsTrigger value="avulsos">Categorias de Avulsos</TabsTrigger>
      </TabsList>
      <TabsContent value="gastos">
        <CategoriaLista tabela="categorias_gastos" categoriasIniciais={categoriasGastosIniciais} />
      </TabsContent>
      <TabsContent value="avulsos">
        <CategoriaLista tabela="categorias_avulsos" categoriasIniciais={categoriasAvulsosIniciais} />
      </TabsContent>
    </Tabs>
  );
}
