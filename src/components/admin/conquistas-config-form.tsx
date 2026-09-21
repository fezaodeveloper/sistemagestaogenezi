"use client";

// "use client": estado do toggle e Server Action de salvar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigConquistas } from "@/app/admin/configuracoes/portal-aluno/gamificacao/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ConquistasConfigForm({ ativoInicial }: { ativoInicial: boolean }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(ativoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startTransition] = useTransition();

  const alterado = ativo !== ativoInicial;

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await salvarConfigConquistas(ativo);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="conquistas-ativo">Habilitar conquistas</Label>
            <p className="text-muted-foreground text-sm">
              Mostra o menu &quot;Conquistas&quot; no portal e desbloqueia as conquistas abaixo automaticamente. Desligado, nada é
              desbloqueado nem exibido (o que já foi desbloqueado fica guardado).
            </p>
          </div>
          <Switch id="conquistas-ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={salvar} disabled={salvando || !alterado}>
            {salvando ? "Salvando..." : "Salvar configuração"}
          </Button>
          {salvo && !alterado && (
            <span role="status" className="text-sm text-green-600 dark:text-green-400">
              Configuração salva.
            </span>
          )}
          {erro && (
            <span role="alert" className="text-destructive text-sm">
              {erro}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
