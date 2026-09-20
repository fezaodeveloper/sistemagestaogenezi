"use client";

// "use client": diálogo de confirmação e estado da exclusão em andamento.

import { useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { ResultadoExclusaoLote } from "@/lib/exclusao-em-lote";
import { Button } from "@/components/ui/button";
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

type ExcluirSelecionadosProps = {
  quantidade: number;
  onExcluir: () => Promise<ResultadoExclusaoLote>;
  onConcluido: (resultado: ResultadoExclusaoLote) => void;
  // Consequência específica da listagem, mostrada abaixo da pergunta padrão
  // (ex.: "as parcelas também serão excluídas").
  aviso?: ReactNode;
};

// Botão "Excluir selecionados" + confirmação, usado nas 4 listagens com
// seleção múltipla. `onExcluir` chama a Server Action de cada listagem (que
// aplica as mesmas regras da exclusão individual); `onConcluido` recebe o
// resultado pra a tela atualizar a lista e manter selecionados só os que falharam.
export function ExcluirSelecionadosButton({ quantidade, onExcluir, onConcluido, aviso }: ExcluirSelecionadosProps) {
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      let resultado: ResultadoExclusaoLote;
      try {
        resultado = await onExcluir();
      } catch {
        resultado = { excluidos: 0, falhas: [], erro: "Não foi possível excluir os itens selecionados. Tente novamente." };
      }
      setAberto(false);
      onConcluido(resultado);
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="destructive" onClick={() => setAberto(true)} disabled={quantidade === 0}>
        <Trash2 />
        Excluir selecionados
      </Button>
      <AlertDialog open={aberto} onOpenChange={(proximo) => !isPending && setAberto(proximo)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {quantidade} item(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {aviso && <div className="text-muted-foreground text-sm">{aviso}</div>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={confirmar}>
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Barra padrão (alunos e agendamentos): contador + limpar + excluir.
export function BarraSelecaoExclusao({
  onLimpar,
  ...excluir
}: ExcluirSelecionadosProps & {
  onLimpar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" role="region" aria-label="Ações em lote">
      <span className="text-sm font-medium">{excluir.quantidade} item(s) selecionado(s)</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onLimpar}>
          Cancelar seleção
        </Button>
        <ExcluirSelecionadosButton {...excluir} />
      </div>
    </div>
  );
}
