"use client";

// "use client": estado dos formulários (useActionState) e status de envio.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithGoogle, signInWithPassword, type LoginState } from "@/app/login/actions";
import { enviarLinkDeAcesso, type LinkAcessoState } from "@/app/entrar/actions";
import type { PortalLoginTipoSenha } from "@/lib/portal-login/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function BotaoEnviar({ texto, textoEnviando }: { texto: string; textoEnviando: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? textoEnviando : texto}
    </Button>
  );
}

function Separador() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <div className="bg-border h-px flex-1" />
      ou
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

function FormSenha() {
  const [state, formAction] = useActionState<LoginState, FormData>(signInWithPassword, undefined);
  return (
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
      <BotaoEnviar texto="Entrar" textoEnviando="Entrando..." />
    </form>
  );
}

// "Somente e-mail": sem campo de senha, o aluno recebe um link de acesso.
function FormLinkDeAcesso() {
  const [state, formAction] = useActionState<LinkAcessoState, FormData>(enviarLinkDeAcesso, undefined);
  return (
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
      {state?.sucesso && (
        <p role="status" className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          {state.sucesso}
        </p>
      )}
      <BotaoEnviar texto="Enviar link de acesso" textoEnviando="Enviando..." />
    </form>
  );
}

// Formulário REAL da tela /entrar. A cor do botão vem da variável --primary que o
// layout define pela cor escolhida no admin.
export function AlunoLoginForm({ tipoSenha }: { tipoSenha: PortalLoginTipoSenha }) {
  return (
    <div className="flex flex-col gap-6">
      {tipoSenha === "so_email" ? <FormLinkDeAcesso /> : <FormSenha />}
      <Separador />
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Entrar com Google
        </Button>
      </form>
    </div>
  );
}

// Versão inerte pro PREVIEW do admin: mesmos campos e visual, nada é enviado.
export function AlunoLoginFormPreview({ tipoSenha }: { tipoSenha: PortalLoginTipoSenha }) {
  return (
    <div className="pointer-events-none flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>E-mail</Label>
          <Input tabIndex={-1} readOnly placeholder="voce@email.com" />
        </div>
        {tipoSenha !== "so_email" && (
          <div className="flex flex-col gap-2">
            <Label>Senha</Label>
            <Input tabIndex={-1} readOnly type="password" placeholder="••••••••" />
          </div>
        )}
        <Button type="button" tabIndex={-1} className="w-full">
          {tipoSenha === "so_email" ? "Enviar link de acesso" : "Entrar"}
        </Button>
      </div>
      <Separador />
      <Button type="button" tabIndex={-1} variant="outline" className="w-full">
        Entrar com Google
      </Button>
    </div>
  );
}
