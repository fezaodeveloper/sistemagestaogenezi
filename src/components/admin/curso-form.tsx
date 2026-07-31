"use client";

import { useActionState } from "react";
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
import {
  CURSO_STATUSES,
  CURSO_STATUS_LABELS,
  CURSO_TIPOS,
  CURSO_TIPO_LABELS,
  type CursoFormValues,
} from "@/lib/cursos/schema";
import type { CursoFormState } from "@/app/admin/cursos/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function CursoForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: CursoFormState, formData: FormData) => Promise<CursoFormState>;
  defaultValues?: Partial<CursoFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<CursoFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs não controlados com os valores ecoados.
  const values = state?.values ?? defaultValues;

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={values?.nome} required />
        {state?.errors?.nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.nome[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" defaultValue={values?.descricao} rows={4} />
        {state?.errors?.descricao && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.descricao[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo">Tipo</Label>
        <Select name="tipo" items={CURSO_TIPO_LABELS} defaultValue={values?.tipo || undefined}>
          <SelectTrigger id="tipo" className="w-full">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {CURSO_TIPOS.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {CURSO_TIPO_LABELS[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.errors?.tipo && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.tipo[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select name="status" items={CURSO_STATUS_LABELS} defaultValue={values?.status || "ativo"}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            {CURSO_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {CURSO_STATUS_LABELS[status]}
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
