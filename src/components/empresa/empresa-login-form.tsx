"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { loginEmpresa, type LoginEmpresaState } from "@/app/empresa/login/actions";
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

export function EmpresaLoginForm() {
  const [state, formAction] = useActionState<LoginEmpresaState, FormData>(loginEmpresa, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        <SubmitButton />
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Ainda não tem conta?{" "}
        <Link href="/empresa/cadastro" className="text-foreground underline underline-offset-2">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
