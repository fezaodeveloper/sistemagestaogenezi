"use client";

// "use client": qual dialog está aberto, alternar ativo e confirmar exclusão.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { alternarAtivoSpedy, excluirSpedy } from "@/app/admin/configuracoes/apps/spedy/actions";
import { SpedyDialog, type SpedyItem } from "@/components/admin/spedy-dialog";
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

export function SpedyView({
  integracoes,
  cursos,
  criptografiaConfigurada,
}: {
  integracoes: SpedyItem[];
  cursos: CursoOpcao[];
  criptografiaConfigurada: boolean;
}) {
  const router = useRouter();
  // undefined = fechado; null = nova integração; objeto = edição.
  const [editando, setEditando] = useState<SpedyItem | null | undefined>(undefined);
  const [excluindo, setExcluindo] = useState<SpedyItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternarAtivo(integracao: SpedyItem, ativo: boolean) {
    setErro(null);
    startTransition(async () => {
      const resultado = await alternarAtivoSpedy(integracao.id, ativo);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirSpedy(alvo.id);
      setExcluindo(null);
      if (resultado.error) setErro(resultado.error);
      router.refresh();
    });
  }

  const nomeCurso = new Map(cursos.map((curso) => [curso.id, curso.nome]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Integrações</h2>
        <Button type="button" onClick={() => setEditando(null)}>
          <Plus />
          Nova integração
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {integracoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma integração com a Spedy ainda.</p>
            <Button type="button" variant="outline" onClick={() => setEditando(null)}>
              <Plus />
              Criar a primeira integração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {integracoes.map((integracao) => (
            <Card key={integracao.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{integracao.nome}</p>
                    <Badge
                      className={
                        integracao.ambiente === "producao"
                          ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                          : "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      }
                    >
                      {integracao.ambiente === "producao" ? "Produção" : "Sandbox"}
                    </Badge>
                    <Badge
                      className={
                        integracao.ativo
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {integracao.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {integracao.cursos_ids.length === 0
                      ? "Todos os cursos"
                      : `Cursos: ${integracao.cursos_ids.map((id) => nomeCurso.get(id) ?? "curso removido").join(", ")}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Ativa</span>
                    <Switch checked={integracao.ativo} disabled={isPending} onCheckedChange={(valor) => alternarAtivo(integracao, valor)} />
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(integracao)}>
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Excluir ${integracao.nome}`}
                    title="Excluir integração"
                    onClick={() => setExcluindo(integracao)}
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
        // key: cada abertura (nova / outra integração) recomeça o formulário do zero.
        <SpedyDialog
          key={editando?.id ?? "nova"}
          integracao={editando}
          cursos={cursos}
          criptografiaConfigurada={criptografiaConfigurada}
          onClose={() => setEditando(undefined)}
        />
      )}

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir integração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{excluindo?.nome}&quot;? A chave de API é apagada daqui e os pagamentos
              deixam de emitir nota automaticamente. As notas já emitidas continuam na Spedy. Esta ação não pode ser desfeita.
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
