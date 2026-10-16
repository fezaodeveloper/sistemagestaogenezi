"use client";

import { useState, useTransition } from "react";
import { solicitarRecuperacaoSenhaAction } from "@/app/recuperar-senha/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mensagem é SEMPRE a mesma, exista ou não conta com esse e-mail — solicitarRecuperacaoSenhaAction
// já não revela se o e-mail existe por conta própria; manter uma única mensagem aqui evita
// reabrir essa brecha no formulário.
const MENSAGEM_SUCESSO = "Se este e-mail estiver cadastrado, você receberá um link em instantes.";

export function RecuperarSenhaForm() {
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErro(null);
    const email = formData.get("email");
    if (typeof email !== "string" || !email.trim()) {
      setErro("Informe um e-mail válido.");
      return;
    }

    startTransition(async () => {
      await solicitarRecuperacaoSenhaAction(email.trim());
      setSucesso(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {sucesso && (
        <p role="status" className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          {MENSAGEM_SUCESSO}
        </p>
      )}
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Enviando..." : "Enviar link de recuperação"}
        </Button>
      </form>
    </div>
  );
}
