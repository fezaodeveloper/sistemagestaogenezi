"use client";

import { useState, useTransition } from "react";
import { iniciarOuAbrirConversaAdmin } from "@/app/admin/chat/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AlunoElegivelChat } from "@/lib/chat/chat";

export function NovaConversaSelect({ alunos }: { alunos: AlunoElegivelChat[] }) {
  const [alunoId, setAlunoId] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleIniciar() {
    if (!alunoId) return;
    setErro(null);
    startTransition(async () => {
      const result = await iniciarOuAbrirConversaAdmin(alunoId);
      if (result?.error) setErro(result.error);
    });
  }

  if (alunos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum aluno com matrícula ativa em curso presencial ou híbrido no momento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={alunoId} onValueChange={(v) => setAlunoId(v ?? "")}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um aluno" />
          </SelectTrigger>
          <SelectContent>
            {alunos.map((aluno) => (
              <SelectItem key={aluno.id} value={aluno.id}>
                {aluno.nome ?? "Aluno"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={!alunoId || isPending} onClick={handleIniciar}>
          {isPending ? "Abrindo..." : "Iniciar conversa"}
        </Button>
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
    </div>
  );
}
