"use client";

// "use client": formulários com estado, confirmação de diálogo e acesso à área de transferência.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";
import { enviarSenhaAlunoWhatsApp, gerarNovaSenhaAluno, trocarEmailAluno } from "@/app/admin/alunos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function AcessoPlataformaAluno({ alunoId, emailAtual }: { alunoId: string; emailAtual: string }) {
  const router = useRouter();

  const [novoEmail, setNovoEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [sucessoEmail, setSucessoEmail] = useState<string | null>(null);
  const [trocandoEmail, startEmail] = useTransition();

  const [confirmarSenhaAberto, setConfirmarSenhaAberto] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [avisoWhatsApp, setAvisoWhatsApp] = useState<string | null>(null);
  const [gerando, startGerar] = useTransition();
  const [enviando, startEnviar] = useTransition();

  function handleTrocarEmail() {
    setErroEmail(null);
    setSucessoEmail(null);
    startEmail(async () => {
      const resultado = await trocarEmailAluno(alunoId, novoEmail);
      if ("error" in resultado) {
        setErroEmail(resultado.error);
        return;
      }
      setSucessoEmail(resultado.email);
      setNovoEmail("");
      router.refresh();
    });
  }

  function handleGerarSenha() {
    setErroSenha(null);
    setCopiada(false);
    setAvisoWhatsApp(null);
    startGerar(async () => {
      const resultado = await gerarNovaSenhaAluno(alunoId);
      setConfirmarSenhaAberto(false);
      if ("error" in resultado) {
        setErroSenha(resultado.error);
        return;
      }
      setSenhaGerada(resultado.senha);
    });
  }

  async function handleCopiar() {
    if (!senhaGerada) return;
    try {
      await navigator.clipboard.writeText(senhaGerada);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      setErroSenha("Não foi possível copiar automaticamente. Selecione a senha e copie manualmente.");
    }
  }

  function handleEnviarWhatsApp() {
    if (!senhaGerada) return;
    setAvisoWhatsApp(null);
    startEnviar(async () => {
      const resultado = await enviarSenhaAlunoWhatsApp(alunoId, senhaGerada);
      setAvisoWhatsApp(
        "error" in resultado
          ? resultado.error
          : "Mensagem preparada. O envio por WhatsApp ainda não está integrado — por ora ela apenas foi registrada no log do servidor.",
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleTrocarEmail} className="flex max-w-md flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label>E-mail de acesso atual</Label>
          <p className="text-sm font-medium">{emailAtual}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-email-aluno">Novo e-mail</Label>
          <Input
            id="novo-email-aluno"
            type="email"
            autoComplete="off"
            placeholder="novo@exemplo.com"
            value={novoEmail}
            onChange={(event) => {
              setNovoEmail(event.target.value);
              setSucessoEmail(null);
            }}
          />
          <p className="text-muted-foreground text-xs">
            A troca é imediata e não envia e-mail de confirmação — o aluno passa a entrar com o novo endereço.
          </p>
        </div>
        {erroEmail && (
          <p role="alert" className="text-destructive text-sm">
            {erroEmail}
          </p>
        )}
        {sucessoEmail && (
          <p className="text-sm text-green-600 dark:text-green-400">E-mail alterado para {sucessoEmail}.</p>
        )}
        <Button type="submit" variant="outline" disabled={trocandoEmail || !novoEmail.trim()} className="w-fit">
          {trocandoEmail ? "Alterando..." : "Alterar e-mail"}
        </Button>
      </form>

      <div className="flex max-w-md flex-col gap-3 border-t pt-6">
        <div className="flex flex-col gap-1">
          <Label>Senha</Label>
          <p className="text-muted-foreground text-xs">
            Gera uma senha aleatória de 8 caracteres (letras e números) e já a aplica na conta. A senha anterior deixa
            de funcionar.
          </p>
        </div>

        <AlertDialog open={confirmarSenhaAberto} onOpenChange={setConfirmarSenhaAberto}>
          <AlertDialogTrigger
            render={
              <Button type="button" variant="outline" className="w-fit">
                <KeyRound />
                Gerar nova senha
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerar nova senha</AlertDialogTitle>
              <AlertDialogDescription>
                A senha atual do aluno será substituída imediatamente por uma senha aleatória. Ela será exibida uma única
                vez, nesta tela.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={gerando} onClick={handleGerarSenha}>
                {gerando ? "Gerando..." : "Gerar nova senha"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {erroSenha && (
          <p role="alert" className="text-destructive text-sm">
            {erroSenha}
          </p>
        )}

        {senhaGerada && (
          <div className="bg-muted/50 flex flex-col gap-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <code
                aria-label="Senha gerada"
                className="bg-background flex-1 rounded-md border px-3 py-2 font-mono text-lg tracking-widest select-all"
              >
                {senhaGerada}
              </code>
              <Button type="button" variant="outline" onClick={handleCopiar}>
                {copiada ? <Check /> : <Copy />}
                {copiada ? "Copiada!" : "Copiar senha"}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Anote ou copie agora: por segurança, a senha não fica salva e não será exibida de novo.
            </p>
            <Button type="button" variant="outline" className="w-fit" disabled={enviando} onClick={handleEnviarWhatsApp}>
              <MessageCircle />
              {enviando ? "Preparando..." : "Enviar por WhatsApp"}
            </Button>
            {avisoWhatsApp && <p className="text-muted-foreground text-xs">{avisoWhatsApp}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
