"use client";

// "use client": precisa do createBrowserClient pra trocar o código PKCE da URL por uma sessão
// de verdade (ver comentário no useEffect abaixo) — isso nunca chega ao servidor.

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { atualizarNovaSenha, type NovaSenhaState } from "@/app/nova-senha/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessaoRecovery = "verificando" | "pronta" | "invalida";

export function NovaSenhaForm() {
  const [sessao, setSessao] = useState<SessaoRecovery>("verificando");
  const [erroClient, setErroClient] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState<NovaSenhaState, FormData>(
    atualizarNovaSenha,
    undefined,
  );

  useEffect(() => {
    // O projeto está configurado pra fluxo PKCE (padrão do supabase-js): o link de recovery do
    // Supabase chega em /nova-senha?code=... — NÃO no fragmento #access_token como num fluxo
    // implícito. Precisa trocar esse código por sessão explicitamente via exchangeCodeForSession;
    // sem isso o updateUser mais abaixo falha com "Auth session missing" (não existe evento
    // automático equivalente ao PASSWORD_RECOVERY pro fluxo PKCE).
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      // queueMicrotask evita setState síncrono direto no corpo do efeito (react-hooks/set-state-in-effect).
      queueMicrotask(() => setSessao("invalida"));
      return;
    }

    let cancelado = false;
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelado) return;
      if (error) {
        setSessao("invalida");
        return;
      }
      // Remove o "code" da URL depois de trocado — ele já foi consumido (um code PKCE só vale
      // uma troca) e não deve sobreviver a um refresh da página nem ficar visível/compartilhável.
      window.history.replaceState({}, "", window.location.pathname);
      setSessao("pronta");
    });

    return () => {
      cancelado = true;
    };
  }, []);

  function validarAntesDeEnviar(evento: React.FormEvent<HTMLFormElement>) {
    setErroClient(null);
    const dados = new FormData(evento.currentTarget);
    const senha = dados.get("senha");
    const confirmarSenha = dados.get("confirmarSenha");
    if (typeof senha !== "string" || senha.length < 6) {
      evento.preventDefault();
      setErroClient("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      evento.preventDefault();
      setErroClient("As senhas não coincidem.");
    }
  }

  if (sessao === "verificando") {
    return <p className="text-muted-foreground text-center text-sm">Verificando link de recuperação...</p>;
  }

  if (sessao === "invalida") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p role="alert" className="text-destructive text-sm">
          Link inválido ou expirado.
        </p>
        <Link href="/recuperar-senha" className="text-primary text-sm underline">
          Pedir novo link de recuperação
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={validarAntesDeEnviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Nova senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={6} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
        <Input
          id="confirmarSenha"
          name="confirmarSenha"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </div>
      {(erroClient ?? state?.error) && (
        <p role="alert" className="text-destructive text-sm">
          {erroClient ?? state?.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
