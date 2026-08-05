"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type AlunoChamada = {
  matriculaId: string;
  nome: string;
  statusInicial: (typeof PRESENCA_STATUSES)[number];
  dataReposicaoInicial: string;
  justificativaInicial: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar chamada"}
    </Button>
  );
}

function ChamadaRow({ aluno }: { aluno: AlunoChamada }) {
  const [status, setStatus] = useState<(typeof PRESENCA_STATUSES)[number]>(aluno.statusInicial);

  return (
    <div className="flex flex-col gap-2 border-b py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`status-${aluno.matriculaId}`} className="font-normal">
          {aluno.nome}
        </Label>
        <Select
          name={`status_${aluno.matriculaId}`}
          items={PRESENCA_STATUS_LABELS}
          defaultValue={aluno.statusInicial}
          onValueChange={(value) => {
            if (value) setStatus(value as (typeof PRESENCA_STATUSES)[number]);
          }}
        >
          <SelectTrigger id={`status-${aluno.matriculaId}`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESENCA_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PRESENCA_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status === "reposicao" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`data_reposicao-${aluno.matriculaId}`} className="text-xs">
            Data da reposição
          </Label>
          <Input
            id={`data_reposicao-${aluno.matriculaId}`}
            name={`data_reposicao_${aluno.matriculaId}`}
            type="date"
            defaultValue={aluno.dataReposicaoInicial}
          />
        </div>
      )}

      {status === "justificada" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`justificativa-${aluno.matriculaId}`} className="text-xs">
            Justificativa
          </Label>
          <Textarea
            id={`justificativa-${aluno.matriculaId}`}
            name={`justificativa_${aluno.matriculaId}`}
            rows={2}
            defaultValue={aluno.justificativaInicial}
          />
        </div>
      )}
    </div>
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
  alunos: AlunoChamada[];
}) {
  const action = registrarPresencas.bind(null, turmaId, aulaId, data);
  const [state, formAction] = useActionState<RegistrarPresencasState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {alunos.map((aluno) => (
          <ChamadaRow key={aluno.matriculaId} aluno={aluno} />
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
