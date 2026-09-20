"use client";

// "use client": continua o envio enquanto a página está aberta, cancelar/duplicar/excluir.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Loader2, Trash2, XCircle } from "lucide-react";
import { cancelarCampanha, continuarEnvio, duplicarCampanha, excluirCampanha } from "@/app/admin/email-marketing/actions";
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

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function EmailCampanhaAcoes({
  id,
  nome,
  status,
  pendentes,
}: {
  id: string;
  nome: string;
  status: string;
  pendentes: number;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<"cancelar" | "excluir" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, startTransition] = useTransition();
  const [enviandoAgora, setEnviandoAgora] = useState(false);
  const ativoRef = useRef(true);

  const emEnvio = status === "enviando" && pendentes > 0;

  // Uma função serverless tem tempo limitado, então o envio anda em "rodadas" de ~50s:
  // enquanto esta página estiver aberta ela pede a próxima rodada até acabar. (Fechada,
  // o cron diário continua de onde parou.)
  useEffect(() => {
    if (!emEnvio) return;
    ativoRef.current = true;
    let vivo = true;

    (async () => {
      setEnviandoAgora(true);
      while (vivo && ativoRef.current) {
        const r = await continuarEnvio(id);
        if ("error" in r) {
          setErro(r.error);
          break;
        }
        router.refresh();
        if (r.concluida || r.restantes === 0) break;
        // Outra execução está enviando agora: espera e tenta de novo.
        if (r.ocupada) await dormir(6000);
      }
      if (vivo) setEnviandoAgora(false);
    })();

    return () => {
      vivo = false;
      ativoRef.current = false;
    };
  }, [emEnvio, id, router]);

  function executar(acao: "cancelar" | "excluir") {
    setErro(null);
    startTransition(async () => {
      const r = acao === "cancelar" ? await cancelarCampanha(id) : await excluirCampanha(id);
      if (r.error) {
        setErro(r.error);
        setConfirmando(null);
        return;
      }
      setConfirmando(null);
      if (acao === "excluir") router.push("/admin/email-marketing");
      else router.refresh();
    });
  }

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const r = await duplicarCampanha(id);
      if ("error" in r) setErro(r.error);
      else router.push(`/admin/email-marketing/${r.id}/editar`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {enviandoAgora && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Enviando… mantenha esta página aberta
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`/admin/email-marketing/${id}/exportar`} />}
        >
          <Download />
          Exportar CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={duplicar} disabled={ocupado}>
          <Copy />
          Duplicar
        </Button>
        {(status === "enviando" || status === "agendada") && (
          <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmando("cancelar")} disabled={ocupado}>
            <XCircle />
            Cancelar envio
          </Button>
        )}
        {status !== "enviando" && (
          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Excluir campanha" onClick={() => setConfirmando("excluir")} disabled={ocupado}>
            <Trash2 />
          </Button>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      )}

      <AlertDialog open={confirmando !== null} onOpenChange={(aberto) => !aberto && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmando === "cancelar" ? "Cancelar envio" : "Excluir campanha"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando === "cancelar"
                ? `Parar o envio de "${nome}"? Quem já recebeu recebeu; os demais destinatários não receberão.`
                : `Excluir "${nome}"? A campanha e o histórico de envios dela serão apagados. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={ocupado} onClick={() => confirmando && executar(confirmando)}>
              {ocupado ? "Aguarde..." : confirmando === "cancelar" ? "Cancelar envio" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
