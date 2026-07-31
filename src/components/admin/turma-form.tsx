"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TURMA_STATUSES, TURMA_STATUS_LABELS, type TurmaFormValues } from "@/lib/turmas/schema";
import type { TurmaFormState } from "@/app/admin/turmas/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function TurmaForm({
  action,
  defaultValues,
  submitLabel,
  cursos,
}: {
  action: (state: TurmaFormState, formData: FormData) => Promise<TurmaFormState>;
  defaultValues?: Partial<TurmaFormValues>;
  submitLabel: string;
  cursos: { id: string; nome: string }[];
}) {
  const [state, formAction] = useActionState<TurmaFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs não controlados com os valores ecoados.
  const values = state?.values ?? defaultValues;
  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="curso_id">Curso</Label>
        <Select name="curso_id" items={cursoItems} defaultValue={values?.curso_id || undefined}>
          <SelectTrigger id="curso_id" className="w-full">
            <SelectValue placeholder="Selecione o curso" />
          </SelectTrigger>
          <SelectContent>
            {cursos.map((curso) => (
              <SelectItem key={curso.id} value={curso.id}>
                {curso.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.errors?.curso_id && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.curso_id[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome da turma</Label>
        <Input id="nome" name="nome" defaultValue={values?.nome} required />
        {state?.errors?.nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.nome[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="data_inicio">Início</Label>
          <Input
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={values?.data_inicio}
            required
          />
          {state?.errors?.data_inicio && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.data_inicio[0]}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="data_fim">Término</Label>
          <Input
            id="data_fim"
            name="data_fim"
            type="date"
            defaultValue={values?.data_fim}
            required
          />
          {state?.errors?.data_fim && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.data_fim[0]}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="capacidade_maxima">Capacidade máxima</Label>
        <Input
          id="capacidade_maxima"
          name="capacidade_maxima"
          type="number"
          min={1}
          defaultValue={values?.capacidade_maxima}
          required
        />
        {state?.errors?.capacidade_maxima && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.capacidade_maxima[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select
          name="status"
          items={TURMA_STATUS_LABELS}
          defaultValue={values?.status || "planejada"}
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            {TURMA_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {TURMA_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.errors?.status && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.status[0]}
          </p>
        )}
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
