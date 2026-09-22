"use client";

// "use client": estado do formulário e Server Action de salvar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarConexaoWhatsapp } from "@/app/admin/configuracoes/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function WhatsappConexaoForm({
  urlInicial,
  instanciaInicial,
  chaveConfigurada,
  ativoInicial,
}: {
  urlInicial: string;
  instanciaInicial: string;
  chaveConfigurada: boolean;
  ativoInicial: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(urlInicial);
  const [instancia, setInstancia] = useState(instanciaInicial);
  const [apiKey, setApiKey] = useState("");
  const [ativo, setAtivo] = useState(ativoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, startTransition] = useTransition();

  function salvar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setOk(false);
    startTransition(async () => {
      const r = await salvarConexaoWhatsapp({ url, instancia, apiKey, ativo });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setApiKey("");
      setOk(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="wa-ativo">Ativo</Label>
          <p className="text-muted-foreground text-xs">Liga o envio automático de WhatsApp pelo sistema.</p>
        </div>
        <Switch id="wa-ativo" checked={ativo} onCheckedChange={setAtivo} disabled={salvando} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="wa-url">URL da Evolution API</Label>
        <Input
          id="wa-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://evolution.seudominio.com"
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="wa-instancia">Nome da instância</Label>
        <Input
          id="wa-instancia"
          value={instancia}
          onChange={(e) => setInstancia(e.target.value)}
          placeholder="genezi"
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="wa-api-key">API Key</Label>
        <Input
          id="wa-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={chaveConfigurada ? "•••••••• (configurada — deixe em branco pra manter)" : "Não configurada"}
          disabled={salvando}
        />
        <p className="text-muted-foreground text-xs">A chave salva nunca é exibida aqui. Deixe em branco para manter a atual.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configuração"}
        </Button>
        {ok && (
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
    </form>
  );
}
