"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mesmo fallback usado em outros pontos do código pra essa mesma variável (ver
// src/lib/email/eventos.ts e outros). NEXT_PUBLIC_* é embutida no bundle do client no build.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app").replace(
  /\/+$/,
  "",
);

// Mensagem é SEMPRE a mesma, exista ou não conta com esse e-mail (ou se o Supabase errar, ex.:
// rate limit) — resetPasswordForEmail já não revela se o e-mail existe por conta própria; manter
// uma única mensagem aqui evita reabrir essa brecha no formulário.
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
      // Chamado do BROWSER de propósito, não de uma Server Action: o fluxo PKCE do Supabase
      // guarda o code_verifier no storage do client que inicia o resetPasswordForEmail — pra
      // o exchangeCodeForSession de /nova-senha (nova-senha-form.tsx) achar esse verifier
      // depois, precisa ser o MESMO client (o do browser), não o client de servidor de uma
      // Server Action, que grava em cookies que o client do browser pode não conseguir ler de
      // volta. Foi exatamente essa inconsistência que causava "Link inválido ou expirado" (o
      // exchange falhava em silêncio, sem lançar erro nenhum no console).
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/nova-senha`,
      });
      if (error) {
        console.error("[recuperar-senha] erro ao pedir reset:", error.message);
      }
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
