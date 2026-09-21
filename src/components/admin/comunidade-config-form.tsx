"use client";

// "use client": estado dos toggles e Server Action de salvar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarConfigComunidade } from "@/app/admin/configuracoes/portal-aluno/comunidade/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ComunidadeConfigForm({ ativoInicial, alunosExcluemInicial }: { ativoInicial: boolean; alunosExcluemInicial: boolean }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(ativoInicial);
  const [alunosExcluem, setAlunosExcluem] = useState(alunosExcluemInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, startTransition] = useTransition();

  const alterado = ativo !== ativoInicial || alunosExcluem !== alunosExcluemInicial;

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await salvarConfigComunidade({ ativo, alunosExcluem });
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
            <Label htmlFor="comunidade-ativo">Habilitar comunidade</Label>
            <p className="text-muted-foreground text-sm">
              Mostra o menu &quot;Comunidade&quot; no portal e libera o fórum para os alunos.
            </p>
          </div>
          <Switch id="comunidade-ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="comunidade-excluem">Alunos podem excluir postagens</Label>
            <p className="text-muted-foreground text-sm">
              Permite que cada aluno exclua os próprios posts e respostas. A exclusão esconde o conteúdo, mas ele continua disponível
              para moderação aqui no painel.
            </p>
          </div>
          <Switch id="comunidade-excluem" checked={alunosExcluem} onCheckedChange={setAlunosExcluem} />
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
