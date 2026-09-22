"use client";

// "use client": estado do formulário e Server Action de teste.

import { useState, useTransition } from "react";
import { enviarTesteWhatsapp } from "@/app/admin/configuracoes/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WhatsappTesteForm() {
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("Olá! Esta é uma mensagem de teste do GênZap. 👋");
  const [resultado, setResultado] = useState<{ ok: boolean; erro?: string } | null>(null);
  const [enviando, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setResultado(null);
    startTransition(async () => {
      const r = await enviarTesteWhatsapp(telefone, mensagem);
      setResultado(r);
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="wa-teste-telefone">Telefone (com DDD)</Label>
        <Input
          id="wa-teste-telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="11999999999"
          disabled={enviando}
          className="max-w-xs"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="wa-teste-mensagem">Mensagem</Label>
        <Textarea id="wa-teste-mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} disabled={enviando} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={enviando || !telefone.trim() || !mensagem.trim()}>
          {enviando ? "Enviando..." : "Enviar teste"}
        </Button>
        {resultado?.ok && (
          <span role="status" className="text-sm text-green-600 dark:text-green-400">
            Mensagem enviada.
          </span>
        )}
        {resultado && !resultado.ok && (
          <span role="alert" className="text-destructive text-sm">
            {resultado.erro}
          </span>
        )}
      </div>
    </form>
  );
}
