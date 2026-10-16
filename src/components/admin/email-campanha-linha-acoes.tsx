"use client";

// "use client": duplicar/excluir disparam Server Actions com useTransition e exigem confirmação
// (AlertDialog) antes de excluir — mesmo padrão de DeleteCursoButton/WhatsappFluxoCard.
//
// Não confundir com EmailCampanhaAcoes (components/admin/email-campanha-acoes.tsx): aquele é o
// painel de ações da PÁGINA DE DETALHES de uma campanha (enviar, agendar, cancelar envio, com
// polling de continuarEnvio) — este aqui é só a linha de ações compacta da TABELA de listagem.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { duplicarCampanha, excluirCampanha } from "@/app/admin/email-marketing/actions";
import type { CampanhaEmailStatus } from "@/lib/email/marketing-tipos";
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

export function EmailCampanhaLinhaAcoes({ id, nome, status }: { id: string; nome: string; status: CampanhaEmailStatus }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  // Rascunho/agendada ainda podem ser editadas (mesma regra de salvarCampanha); as demais só têm
  // histórico pra ver, não formulário pra editar.
  const editavel = status === "rascunho" || status === "agendada";
  const href = editavel ? `/admin/email-marketing/${id}/editar` : `/admin/email-marketing/${id}`;

  // excluirCampanha (Server Action) já bloqueia "enviando" no banco — aqui o botão só aparece
  // pra rascunho/cancelada, que é a regra de produto pedida nesta tela (campanha agendada ou já
  // enviada continua tendo o botão oculto na lista, mesmo que a action em si permita mais casos
  // — a página de detalhes tem sua própria regra de exibição, independente desta).
  const podeExcluir = status === "rascunho" || status === "cancelada";

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const r = await duplicarCampanha(id);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function excluir() {
    startTransition(async () => {
      const r = await excluirCampanha(id);
      if (r.error) {
        setErro(r.error);
        setConfirmandoExcluir(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1">
        <Button render={<Link href={href} />} nativeButton={false} variant="ghost" size="sm">
          {editavel ? "Editar" : "Ver"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={duplicar}>
          Duplicar
        </Button>
        {podeExcluir && (
          <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => setConfirmandoExcluir(true)}>
            Excluir
          </Button>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}

      <AlertDialog open={confirmandoExcluir} onOpenChange={(v) => !pendente && setConfirmandoExcluir(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pendente} onClick={excluir}>
              {pendente ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
