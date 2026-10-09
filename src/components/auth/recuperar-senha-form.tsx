"use client";

import { useActionState } from "react";
import { enviarLinkRecuperacaoSenha, type RecuperarSenhaState } from "@/app/recuperar-senha/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecuperarSenhaForm() {
  const [state, formAction, isPending] = useActionState<RecuperarSenhaState, FormData>(
    enviarLinkRecuperacaoSenha,
    undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Mesmo padrão de mensagem de sucesso de FormLinkDeAcesso (aluno-login-form.tsx) — forma
          continua visível (permite reenviar/tentar outro e-mail) em vez de some sozinha. */}
      {state?.sucesso && (
        <p role="status" className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          {state.sucesso}
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Enviando..." : "Enviar link de recuperação"}
        </Button>
      </form>
    </div>
  );
}
