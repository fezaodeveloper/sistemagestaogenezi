"use client";

// "use client": CPF controlado + submissão via Server Action. Estado de autenticação vive só
// em useState (memória do componente) — SEM sessionStorage/localStorage de propósito (restrição
// da tarefa): fechar/recarregar a aba exige digitar o CPF de novo.

import { useState, useTransition, type FormEvent } from "react";
import { validarCpfResponsavel } from "@/app/responsavel/[alunoId]/actions";
import { PortalResponsavelDashboard } from "@/components/responsavel/portal-responsavel-dashboard";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function PortalResponsavelAuth({ alunoId, nomeAluno }: { alunoId: string; nomeAluno: string }) {
  const [autenticado, setAutenticado] = useState(false);
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await validarCpfResponsavel(alunoId, cpf);
      if (!resultado.valido) {
        setErro(resultado.erro);
        return;
      }
      setAutenticado(true);
    });
  }

  if (autenticado) {
    return <PortalResponsavelDashboard alunoId={alunoId} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Portal do Responsável</h1>
        <p className="text-muted-foreground text-sm">Acessando dados de: {nomeAluno}</p>
      </div>
      <Card className="max-w-sm">
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cpf_responsavel">Digite o CPF do responsável</Label>
              <CpfInput id="cpf_responsavel" value={cpf} onValueChange={setCpf} required />
            </div>
            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}
            <Button type="submit" disabled={isPending || !cpfCompleto(cpf)}>
              {isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
