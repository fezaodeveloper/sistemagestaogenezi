"use client";

// "use client": diálogo de confirmação + acesso à área de transferência pra copiar a senha
// gerada — mesmo padrão de AcessoPlataformaAluno (bloco "Senha" daquele componente).

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Send } from "lucide-react";
import { enviarSenhaPortalResponsavel, gerarNovaSenhaResponsavel } from "@/app/admin/alunos/actions";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RedefinirSenhaResponsavel({ responsavelId, jaTemSenha }: { responsavelId: string; jaTemSenha: boolean }) {
  const [confirmarAberto, setConfirmarAberto] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [mensagemWhatsapp, setMensagemWhatsapp] = useState<string | null>(null);
  const [whatsappEnviado, setWhatsappEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroWhatsapp, setErroWhatsapp] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [gerando, startGerar] = useTransition();
  const [reenviando, startReenviar] = useTransition();

  function handleGerar() {
    setErro(null);
    setErroWhatsapp(null);
    setCopiada(false);
    startGerar(async () => {
      const resultado = await gerarNovaSenhaResponsavel(responsavelId);
      setConfirmarAberto(false);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setSenhaGerada(resultado.senha);

      // Envia por WhatsApp automaticamente, logo após gerar — a senha nunca é gravada em claro
      // em lugar nenhum, então este é o único momento em que ela existe pra ser enviada.
      const envio = await enviarSenhaPortalResponsavel(responsavelId, resultado.senha);
      if ("error" in envio) {
        setErroWhatsapp(envio.error);
        return;
      }
      setMensagemWhatsapp(envio.mensagem);
      setWhatsappEnviado(envio.enviado);
    });
  }

  // "Reenviar" não gera senha nova — reenvia a mesma que já está na tela (a única que existe em
  // claro agora; não há como reenviar uma senha anterior, só o hash dela ficou salvo).
  function handleReenviarWhatsapp() {
    if (!senhaGerada) return;
    setErroWhatsapp(null);
    startReenviar(async () => {
      const envio = await enviarSenhaPortalResponsavel(responsavelId, senhaGerada);
      if ("error" in envio) {
        setErroWhatsapp(envio.error);
        return;
      }
      setMensagemWhatsapp(envio.mensagem);
      setWhatsappEnviado(envio.enviado);
    });
  }

  async function handleCopiar() {
    if (!senhaGerada) return;
    try {
      await navigator.clipboard.writeText(senhaGerada);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      setErro("Não foi possível copiar automaticamente. Selecione a senha e copie manualmente.");
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {jaTemSenha
          ? "O responsável já tem uma senha do portal. Gerar uma nova substitui a atual imediatamente."
          : "O responsável ainda não tem senha do portal — sem ela, só consegue entrar com o CPF (acesso antigo)."}
      </p>

      <AlertDialog open={confirmarAberto} onOpenChange={setConfirmarAberto}>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="outline" className="w-fit">
              <KeyRound />
              {jaTemSenha ? "Redefinir senha do portal" : "Gerar senha do portal"}
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{jaTemSenha ? "Redefinir senha do portal" : "Gerar senha do portal"}</AlertDialogTitle>
            <AlertDialogDescription>
              {jaTemSenha
                ? "A senha atual do responsável será substituída por uma nova senha numérica de 6 dígitos e enviada por WhatsApp. Ela também será exibida uma única vez, nesta tela."
                : "Será gerada uma senha numérica de 6 dígitos e enviada por WhatsApp ao responsável. Ela também será exibida uma única vez, nesta tela."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={gerando} onClick={handleGerar}>
              {gerando ? "Gerando..." : "Gerar senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {senhaGerada && (
        <div className="bg-muted/50 flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <code
              aria-label="Senha gerada"
              className="bg-background flex-1 rounded-md border px-3 py-2 text-center font-mono text-lg tracking-widest select-all"
            >
              {senhaGerada}
            </code>
            <Button type="button" variant="outline" onClick={handleCopiar}>
              {copiada ? <Check /> : <Copy />}
              {copiada ? "Copiada!" : "Copiar"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Anote esta senha — não será exibida novamente. Repasse ao responsável junto com o link do portal
            (/responsavel).
          </p>

          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">
                {whatsappEnviado ? "✅ Enviado por WhatsApp" : "Mensagem do WhatsApp"}
              </span>
              <Button type="button" variant="outline" size="sm" disabled={reenviando} onClick={handleReenviarWhatsapp}>
                <Send />
                {reenviando ? "Enviando..." : "Reenviar WhatsApp"}
              </Button>
            </div>
            {erroWhatsapp && (
              <p role="alert" className="text-destructive text-xs">
                {erroWhatsapp}
              </p>
            )}
            {mensagemWhatsapp && (
              <pre className="bg-background text-muted-foreground whitespace-pre-wrap rounded-md border p-2 text-xs">
                {mensagemWhatsapp}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
