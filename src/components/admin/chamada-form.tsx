"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRESENCA_STATUSES, PRESENCA_STATUS_LABELS } from "@/lib/presencas/schema";
import {
  registrarPresencas,
  type RegistrarPresencasState,
} from "@/app/admin/turmas/[id]/presencas/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar chamada"}
    </Button>
  );
}

export function ChamadaForm({
  turmaId,
  aulaId,
  data,
  alunos,
}: {
  turmaId: string;
  aulaId: string;
  data: string;
  alunos: {
    matriculaId: string;
    nome: string;
    statusInicial: (typeof PRESENCA_STATUSES)[number];
  }[];
}) {
  const action = registrarPresencas.bind(null, turmaId, aulaId, data);
  const [state, formAction] = useActionState<RegistrarPresencasState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {alunos.map((aluno) => (
          <div
            key={aluno.matriculaId}
            className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
          >
            <Label htmlFor={`status-${aluno.matriculaId}`} className="font-normal">
              {aluno.nome}
            </Label>
            <Select
              name={`status_${aluno.matriculaId}`}
              items={PRESENCA_STATUS_LABELS}
              defaultValue={aluno.statusInicial}
            >
              <SelectTrigger id={`status-${aluno.matriculaId}`} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESENCA_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PRESENCA_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
