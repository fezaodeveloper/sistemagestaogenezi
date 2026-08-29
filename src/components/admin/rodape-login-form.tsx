"use client";

import { useState, useTransition } from "react";
import { salvarRodapeLogin } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RODAPE_LOGIN_PADRAO = "© 2026 GÊNEZI Educação Profissional";

export function RodapeLoginForm({ rodapeInicial }: { rodapeInicial: string | null }) {
  const [rodape, setRodape] = useState(rodapeInicial ?? RODAPE_LOGIN_PADRAO);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function handleSalvar() {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await salvarRodapeLogin(rodape);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-2">
      <Label htmlFor="login-rodape">Texto do rodapé</Label>
      <Input
        id="login-rodape"
        value={rodape}
        onChange={(event) => {
          setRodape(event.target.value);
          setSalvo(false);
        }}
        placeholder={RODAPE_LOGIN_PADRAO}
      />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSalvar}>
          {isPending ? "Salvando..." : "Salvar rodapé"}
        </Button>
        {salvo && !error && <span className="text-muted-foreground text-sm">Salvo.</span>}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
