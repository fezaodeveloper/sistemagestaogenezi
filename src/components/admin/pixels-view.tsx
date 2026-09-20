"use client";

// "use client": qual dialog está aberto, alternar ativo e confirmar exclusão.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { alternarAtivoPixel, excluirPixel } from "@/app/admin/configuracoes/apps/pixels/actions";
import { PIXEL_TIPO_CURTOS, isPixelTipo } from "@/lib/pixels/tipos";
import { PixelDialog, type PixelItem } from "@/components/admin/pixel-dialog";
import type { CursoOpcao } from "@/components/admin/cursos-checklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PixelsView({ pixels, cursos }: { pixels: PixelItem[]; cursos: CursoOpcao[] }) {
  const router = useRouter();
  // undefined = fechado; null = novo pixel; objeto = edição.
  const [editando, setEditando] = useState<PixelItem | null | undefined>(undefined);
  const [excluindo, setExcluindo] = useState<PixelItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternarAtivo(pixel: PixelItem, ativo: boolean) {
    setErro(null);
    startTransition(async () => {
      const resultado = await alternarAtivoPixel(pixel.id, ativo);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirPixel(alvo.id);
      setExcluindo(null);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  const nomeCurso = new Map(cursos.map((curso) => [curso.id, curso.nome]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Pixels cadastrados</h2>
        <Button type="button" onClick={() => setEditando(null)}>
          <Plus />
          Novo
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {pixels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum pixel cadastrado ainda.</p>
            <Button type="button" variant="outline" onClick={() => setEditando(null)}>
              <Plus />
              Cadastrar o primeiro pixel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pixels.map((pixel) => (
            <Card key={pixel.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{pixel.nome}</p>
                    <Badge variant="secondary">{isPixelTipo(pixel.tipo) ? PIXEL_TIPO_CURTOS[pixel.tipo] : pixel.tipo}</Badge>
                    <Badge
                      className={
                        pixel.ativo
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {pixel.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {pixel.cursos_ids.length === 0
                      ? "Todas as páginas públicas"
                      : `Cursos: ${pixel.cursos_ids.map((id) => nomeCurso.get(id) ?? "curso removido").join(", ")}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Ativo</span>
                    <Switch checked={pixel.ativo} disabled={isPending} onCheckedChange={(valor) => alternarAtivo(pixel, valor)} />
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(pixel)}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Excluir ${pixel.nome}`}
                    title="Excluir pixel"
                    onClick={() => setExcluindo(pixel)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editando !== undefined && (
        // key: cada abertura (novo / outro pixel) recomeça o formulário do zero.
        <PixelDialog key={editando?.id ?? "novo"} pixel={editando} cursos={cursos} onClose={() => setEditando(undefined)} />
      )}

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pixel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{excluindo?.nome}&quot;? O código deixa de ser carregado nas páginas
              públicas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={confirmarExclusao}>
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
