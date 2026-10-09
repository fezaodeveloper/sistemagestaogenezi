"use client";

// "use client": precisa do createBrowserClient pra detectar a sessão de recovery a partir do
// #access_token na URL (ver comentário no useEffect abaixo) — isso nunca chega ao servidor.

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
    const supabase = createClient();

    // O link de recovery do Supabase chega com os tokens no FRAGMENTO da URL
    // (#access_token=...&type=recovery) — createBrowserClient (@supabase/ssr) já detecta e
    // processa isso automaticamente ao montar (detectSessionInUrl, ligado por padrão), sem
    // precisar ler window.location.hash nem chamar setSession() à mão aqui. PASSWORD_RECOVERY é
    // o evento oficial que ele dispara quando reconhece esse fluxo (doc do supabase-js);
    // INITIAL_SESSION com uma sessão já presente cobre o caso de o hash já ter sido processado
    // antes deste componente montar.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "INITIAL_SESSION" && session)) {
        setSessao("pronta");
      }
    });

    // Link inválido/expirado nunca dispara PASSWORD_RECOVERY — sem isso a pessoa ficaria
    // esperando pra sempre em "Verificando...".
    const timeout = setTimeout(() => {
      setSessao((atual) => (atual === "verificando" ? "invalida" : atual));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
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
