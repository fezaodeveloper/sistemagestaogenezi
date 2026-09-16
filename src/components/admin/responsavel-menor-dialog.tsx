"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { formatCpf } from "@/lib/alunos/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ResponsavelMenor = { nome: string; cpf: string };

// Pergunta simples antes de gerar o comprovante (item 5 do roadmap):
// responsavel_nome/responsavel_cpf não vêm de nenhuma tabela — o admin
// preenche aqui, na hora de imprimir, só quando o aluno é menor de idade.
// "Gerar PDF" precisa continuar sendo o clique síncrono que abre a aba
// (window.open) em matricula-detalhes.tsx/matricula-wizard.tsx — por isso
// esse componente só repassa a resposta pro callback do pai, sem nenhum
// await no meio, e o pai decide window.open logo na primeira linha.
export function ResponsavelMenorDialog({
  trigger,
  gerandoPdf,
  onConfirmar,
}: {
  trigger: ReactElement;
  gerandoPdf: boolean;
  onConfirmar: (responsavel: ResponsavelMenor | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ehMenor, setEhMenor] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setEhMenor(false);
      setNome("");
      setCpf("");
    }
  }

  function handleGerar() {
    setOpen(false);
    onConfirmar(ehMenor && nome.trim() ? { nome: nome.trim(), cpf: cpf.trim() } : null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Imprimir comprovante</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="eh-menor" className="font-normal">
              Aluno é menor de idade?
            </Label>
            <Switch id="eh-menor" checked={ehMenor} onCheckedChange={setEhMenor} />
          </div>
          {ehMenor && (
            <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-3 duration-300">
              <div className="flex flex-col gap-2">
                <Label htmlFor="responsavel-nome">Nome do responsável</Label>
                <Input
                  id="responsavel-nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="responsavel-cpf">CPF do responsável</Label>
                <Input
                  id="responsavel-cpf"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleGerar} disabled={gerandoPdf}>
            {gerandoPdf ? "Gerando..." : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

