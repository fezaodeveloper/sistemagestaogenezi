"use client";

// "use client": estado do textarea (contador de caracteres) e Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarResposta } from "@/app/aluno/comunidade/actions";
import { LIMITE_CONTEUDO_RESPOSTA } from "@/lib/comunidade/tipos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ComunidadeRespostaForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await criarResposta(postId, texto);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setTexto("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={LIMITE_CONTEUDO_RESPOSTA}
        rows={3}
        placeholder="Escreva uma resposta..."
        aria-label="Nova resposta"
        disabled={pendente}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${LIMITE_CONTEUDO_RESPOSTA - texto.length <= 100 ? "text-amber-600" : "text-muted-foreground"}`}>
          {texto.length}/{LIMITE_CONTEUDO_RESPOSTA}
        </span>
        <Button type="submit" disabled={pendente || texto.trim().length === 0}>
          {pendente ? "Enviando..." : "Responder"}
        </Button>
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
    </form>
  );
}
