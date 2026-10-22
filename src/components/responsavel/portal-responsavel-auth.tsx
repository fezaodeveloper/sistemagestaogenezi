"use client";

// "use client": CPF controlado + submissão via Server Action. Estado de autenticação vive só
// em useState (memória do componente) — SEM sessionStorage/localStorage de propósito (restrição
// da tarefa): fechar/recarregar a aba exige digitar o CPF de novo.
//
// Sem alunoId/nomeAluno como prop (diferente da versão anterior, que vinha da URL
// /responsavel/[alunoId]): agora o aluno só é conhecido DEPOIS que o CPF é validado por
// validarCpfResponsavelGlobal(), que varre responsaveis.cpf inteira em busca de quem digitou.

import { useState, useTransition, type FormEvent } from "react";
import { validarCpfResponsavelGlobal } from "@/app/responsavel/actions";
import { PortalResponsavelDashboard } from "@/components/responsavel/portal-responsavel-dashboard";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function PortalResponsavelAuth() {
  const [autenticado, setAutenticado] = useState<{ alunoId: string; nomeAluno: string } | null>(null);
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await validarCpfResponsavelGlobal(cpf);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setAutenticado({ alunoId: resultado.alunoId, nomeAluno: resultado.nomeAluno ?? "Aluno" });
    });
  }

  if (autenticado) {
    return <PortalResponsavelDashboard alunoId={autenticado.alunoId} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Portal do Responsável</h1>
        <p className="text-muted-foreground text-sm">
          Digite o CPF cadastrado como responsável para acessar os dados do aluno.
        </p>
      </div>
      <Card className="max-w-sm">
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cpf_responsavel">CPF do responsável</Label>
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
