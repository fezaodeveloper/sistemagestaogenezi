"use client";

// "use client": estado dos toggles e Server Action de salvar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigComentarios } from "@/app/admin/configuracoes/portal-aluno/comentarios/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ComentariosConfigForm({ ativoInicial, moderacaoInicial }: { ativoInicial: boolean; moderacaoInicial: boolean }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(ativoInicial);
  const [moderacao, setModeracao] = useState(moderacaoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startTransition] = useTransition();

  const alterado = ativo !== ativoInicial || moderacao !== moderacaoInicial;

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await salvarConfigComentarios({ ativo, moderacao });
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
            <Label htmlFor="comentarios-ativo">Ativar comentários nas aulas</Label>
            <p className="text-muted-foreground text-sm">
              Mostra a seção de comentários ao final de cada aula no portal do aluno.
            </p>
          </div>
          <Switch id="comentarios-ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="comentarios-moderacao">Comentários exigem aprovação</Label>
            <p className="text-muted-foreground text-sm">
              Ligado: o comentário só aparece para os colegas depois que você aprovar. Desligado: aparece imediatamente.
              Vale para os comentários novos — os que já existem mantêm o status.
            </p>
          </div>
          <Switch id="comentarios-moderacao" checked={moderacao} onCheckedChange={setModeracao} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={salvar} disabled={salvando || !alterado}>
            {salvando ? "Salvando..." : "Salvar configurações"}
          </Button>
          {salvo && !alterado && (
            <span role="status" className="text-sm text-green-600 dark:text-green-400">
              Configurações salvas.
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
