"use client";

// "use client": input de CPF controlado + submissão via Server Action com feedback de
// sucesso/erro. O resto da página (dados do aluno/curso, preview do PDF) fica no Server
// Component pai (page.tsx) — só a parte interativa vive aqui, convenção padrão do projeto.

import { useState, useTransition, type FormEvent } from "react";
import { assinarContratoPorCpf } from "@/app/contrato/[matriculaId]/actions";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function ContratoAssinarForm({
  matriculaId,
  precisaResponsavel,
}: {
  matriculaId: string;
  precisaResponsavel: boolean;
}) {
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await assinarContratoPorCpf(matriculaId, cpf);
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
          <p className="text-lg font-medium">✅ Contrato assinado com sucesso!</p>
          <Button
            render={<a href={`/api/contratos/${matriculaId}/pdf`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            Baixar PDF do contrato
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cpf_assinatura">
              {precisaResponsavel ? "Digite o CPF do responsável" : "Digite seu CPF"}
            </Label>
            <CpfInput id="cpf_assinatura" value={cpf} onValueChange={setCpf} required />
          </div>
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={isPending || !cpfCompleto(cpf)}>
            {isPending ? "Assinando..." : "Assinar Contrato"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
