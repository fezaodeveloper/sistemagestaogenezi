"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithPassword, signInWithGoogle, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

// "from" só decide pra onde o link "Esqueci minha senha" volta depois (ver
// src/app/recuperar-senha/page.tsx) — este mesmo LoginForm é usado tanto em /login (admin) quanto
// no fallback de /entrar (aluno, quando a tela de login ainda não tem configuração de portal).
export function LoginForm({ from = "admin" }: { from?: "admin" | "aluno" }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signInWithPassword, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        <SubmitButton />
        <Link href={`/recuperar-senha?from=${from}`} className="text-muted-foreground hover:text-foreground text-center text-sm underline">
          Esqueci minha senha
        </Link>
      </form>

      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <div className="bg-border h-px flex-1" />
        ou
        <div className="bg-border h-px flex-1" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Entrar com Google
        </Button>
      </form>
    </div>
  );
}
