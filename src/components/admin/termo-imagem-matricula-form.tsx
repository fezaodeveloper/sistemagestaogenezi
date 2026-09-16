"use client";

import { useState, useTransition } from "react";
import { salvarTermoImagemMatricula } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TERMO_IMAGEM_PADRAO =
  "Autorizo a Gênezi Educação Profissional a utilizar minha imagem e voz, captadas durante as " +
  "atividades do curso, em materiais institucionais, redes sociais e divulgação da escola, sem " +
  "fins lucrativos e sem direito a remuneração.";

export function TermoImagemMatriculaForm({ textoInicial }: { textoInicial: string | null }) {
  const [texto, setTexto] = useState(textoInicial ?? TERMO_IMAGEM_PADRAO);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function handleSalvar() {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await salvarTermoImagemMatricula(texto);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="termo-imagem-texto">Texto do Termo de Imagem (aparece no comprovante de matrícula)</Label>
      <Textarea
        id="termo-imagem-texto"
        rows={5}
        value={texto}
        onChange={(event) => {
          setTexto(event.target.value);
          setSalvo(false);
        }}
      />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSalvar}>
          {isPending ? "Salvando..." : "Salvar"}
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
