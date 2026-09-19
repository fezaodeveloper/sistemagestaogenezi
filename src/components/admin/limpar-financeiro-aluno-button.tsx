"use client";

// "use client": confirm dialog, estado de envio e feedback do resultado.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { limparFinanceiroAluno } from "@/app/admin/financeiro/actions";
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

export function LimparFinanceiroAlunoButton({
  alunoId,
  nomeAluno,
  totalParcelas,
  totalPagamentos,
}: {
  alunoId: string;
  nomeAluno: string;
  totalParcelas: number;
  totalPagamentos: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLimpar() {
    setErro(null);
    setResultado(null);
    startTransition(async () => {
      const resposta = await limparFinanceiroAluno(alunoId);
      setAberto(false);
      if ("error" in resposta) {
        setErro(resposta.error);
        return;
      }
      setResultado(
        `Financeiro limpo: ${resposta.parcelasExcluidas} parcela(s) e ${resposta.pagamentosExcluidos} pagamento(s) excluído(s).` +
          (resposta.cobrancasAsaasNaoCanceladas > 0
            ? ` Atenção: ${resposta.cobrancasAsaasNaoCanceladas} cobrança(s) em aberto no Asaas não puderam ser canceladas automaticamente — cancele-as no painel do Asaas.`
            : ""),
      );
      router.refresh();
    });
  }

  const nadaParaLimpar = totalParcelas === 0 && totalPagamentos === 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Este aluno tem <strong>{totalParcelas}</strong> parcela(s) e <strong>{totalPagamentos}</strong> pagamento(s)
        avulso(s) registrados. Limpar o financeiro remove tudo isso, mas <strong>mantém as matrículas</strong>.
      </p>

      <Button
        type="button"
        variant="outline"
        className="text-destructive w-fit"
        disabled={nadaParaLimpar || isPending}
        onClick={() => setAberto(true)}
      >
        <Trash2 />
        Limpar financeiro
      </Button>

      {resultado && <p className="text-sm text-green-600 dark:text-green-400">{resultado}</p>}
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar financeiro de {nomeAluno}</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá excluir <strong>TODAS as parcelas e pagamentos deste aluno</strong> ({totalParcelas} parcela(s)
              e {totalPagamentos} pagamento(s) avulso(s)). As matrículas continuam intactas. Cobranças ainda em aberto
              no Asaas serão canceladas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleLimpar}>
              {isPending ? "Limpando..." : "Limpar financeiro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
