"use client";

// "use client": precisa do createBrowserClient pra trocar o token_hash da URL por uma sessão de
// verdade (ver comentário no useEffect abaixo) — isso nunca chega ao servidor.

import Link from "next/link";
import { Loader2 } from "lucide-react";
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
    // O fluxo PKCE (code=...) dependia de um redirect intermediário do próprio Supabase
    // (.../auth/v1/verify?token=pkce_...&redirect_to=...) que o Chrome passou a bloquear como
    // "bounce tracking protection" — o ?code= nunca chegava em /nova-senha. token_hash evita
    // esse salto: o Supabase manda o usuário direto pra /nova-senha?token_hash=...&type=recovery
    // (sem redirect intermediário), e verifyOtp troca esse hash por sessão — mesmo padrão já
    // usado em src/app/auth/callback/route.ts pros outros fluxos de recovery/magic-link deste
    // projeto. Exige trocar o link do template "Reset Password" no Supabase Dashboard (ver
    // relatório) — sem isso o Supabase continua mandando o link antigo baseado em ConfirmationURL.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (!tokenHash || type !== "recovery") {
      // queueMicrotask evita setState síncrono direto no corpo do efeito (react-hooks/set-state-in-effect).
      queueMicrotask(() => setSessao("invalida"));
      return;
    }

    let cancelado = false;
    const supabase = createClient();
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
      // Diagnóstico temporário — remover depois de confirmado em produção que o link de
      // recuperação está funcionando de ponta a ponta.
      console.log("[nova-senha] token_hash resultado:", error?.message ?? "ok");
      if (cancelado) return;
      if (error) {
        setSessao("invalida");
        return;
      }
      // Remove o token_hash da URL depois de trocado — ele já foi consumido (um token_hash só
      // vale uma troca) e não deve sobreviver a um refresh da página nem ficar visível/compartilhável.
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
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
        <p className="text-muted-foreground text-sm">Verificando link de recuperação...</p>
      </div>
    );
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
