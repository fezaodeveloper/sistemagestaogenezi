"use client";

import { useState, useTransition } from "react";
import { trocarSenhaAluno } from "@/app/admin/alunos/actions";
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

export function TrocarSenhaAlunoForm({ alunoId }: { alunoId: string }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const senhasValidas = novaSenha.length >= 6 && novaSenha === confirmarSenha;

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const resultado = await trocarSenhaAluno(alunoId, novaSenha);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSucesso(true);
      setNovaSenha("");
      setConfirmarSenha("");
      setOpen(false);
    });
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nova-senha-aluno">Nova senha</Label>
        <Input
          id="nova-senha-aluno"
          type="password"
          value={novaSenha}
          onChange={(event) => {
            setNovaSenha(event.target.value);
            setSucesso(false);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmar-senha-aluno">Confirmar nova senha</Label>
        <Input
          id="confirmar-senha-aluno"
          type="password"
          value={confirmarSenha}
          onChange={(event) => {
            setConfirmarSenha(event.target.value);
            setSucesso(false);
          }}
        />
      </div>

      {novaSenha.length > 0 && novaSenha.length < 6 && (
        <p className="text-destructive text-sm">A nova senha precisa ter pelo menos 6 caracteres.</p>
      )}
      {confirmarSenha.length > 0 && novaSenha !== confirmarSenha && (
        <p className="text-destructive text-sm">As senhas não coincidem.</p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {sucesso && <p className="text-sm text-green-600 dark:text-green-400">Senha redefinida com sucesso.</p>}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" variant="destructive" disabled={!senhasValidas} className="w-fit">
              Redefinir senha
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha do aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja redefinir a senha deste aluno? O aluno precisará usar a nova senha no
              próximo acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirmar}>
              {isPending ? "Redefinindo..." : "Redefinir senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
