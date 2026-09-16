"use client";

import { useState, useTransition } from "react";
import { enviarSolicitacaoLgpd } from "@/app/aluno/legal/lgpd/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIPOS_SOLICITACAO: Record<string, string> = {
  acesso: "Acesso aos meus dados",
  correcao: "Correção de dados incorretos",
  exclusao: "Exclusão dos meus dados",
  portabilidade: "Portabilidade dos dados",
  revogacao: "Revogação de consentimento",
  outro: "Outro",
};

export function LgpdSolicitacaoForm() {
  const [tipo, setTipo] = useState("acesso");
  const [mensagem, setMensagem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSucesso(false);
    formData.set("tipo", TIPOS_SOLICITACAO[tipo] ?? tipo);

    startTransition(async () => {
      const resultado = await enviarSolicitacaoLgpd(formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSucesso(true);
      setMensagem("");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo-solicitacao">Tipo de solicitação</Label>
        <Select
          items={TIPOS_SOLICITACAO}
          value={tipo}
          onValueChange={(value) => setTipo(value as string)}
        >
          <SelectTrigger id="tipo-solicitacao" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(TIPOS_SOLICITACAO).map((chave) => (
              <SelectItem key={chave} value={chave}>
                {TIPOS_SOLICITACAO[chave]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mensagem-lgpd">Mensagem</Label>
        <Textarea
          id="mensagem-lgpd"
          name="mensagem"
          rows={4}
          value={mensagem}
          onChange={(event) => setMensagem(event.target.value)}
          placeholder="Descreva sua solicitação..."
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {sucesso && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Solicitação enviada. A administração entrará em contato em breve.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </form>
  );
}
