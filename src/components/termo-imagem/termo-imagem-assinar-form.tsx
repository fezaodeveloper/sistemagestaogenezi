"use client";

// "use client": mesmo padrão exato de src/components/contrato/contrato-assinar-form.tsx — input
// de CPF controlado + submissão via Server Action com feedback de sucesso/erro. Agora também
// mostra o texto do termo (pra leitura) + checkbox de concordância antes do formulário de CPF —
// termo chega como prop (serializável: TermoLegal | null), preenchido tanto por um Server
// Component (src/app/termo-imagem/[matriculaId]/assinar/page.tsx) quanto por uma Server Action
// chamada no client (getConteudoTermoImagem, usada por ContratoAssinarForm no fluxo inline).

import { useState, useTransition, type FormEvent } from "react";
import { assinarTermoImagemPorCpf } from "@/app/termo-imagem/[matriculaId]/actions";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { TermoImagemFallback } from "@/components/termo-imagem/termo-imagem-fallback";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TermoLegal } from "@/lib/termos-legais/schema";

export function TermoImagemAssinarForm({
  matriculaId,
  precisaResponsavel,
  termo,
}: {
  matriculaId: string;
  precisaResponsavel: boolean;
  termo: TermoLegal | null;
}) {
  const [cpf, setCpf] = useState("");
  const [concordou, setConcordou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await assinarTermoImagemPorCpf(matriculaId, cpf);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setSucesso(true);
    });
  }

  if (sucesso) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-lg font-medium">✅ Termo de imagem assinado com sucesso!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="py-6">
          <div className="max-h-100 overflow-y-auto rounded-md border bg-muted/40 p-4">
            <TermoLegalContent termo={termo} fallback={<TermoImagemFallback />} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="li_e_concordo_termo_imagem"
                checked={concordou}
                onCheckedChange={(checked) => setConcordou(checked === true)}
              />
              <Label htmlFor="li_e_concordo_termo_imagem" className="font-normal leading-snug">
                Li e concordo com os termos acima
              </Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cpf_termo_imagem">
                {precisaResponsavel ? "Digite o CPF do responsável" : "Digite seu CPF"}
              </Label>
              <CpfInput id="cpf_termo_imagem" value={cpf} onValueChange={setCpf} required />
            </div>
            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}
            <Button type="submit" disabled={isPending || !concordou || !cpfCompleto(cpf)}>
              {isPending ? "Assinando..." : "Assinar Termo de Imagem"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
