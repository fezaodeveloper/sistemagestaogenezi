"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ModuloFormValues } from "@/lib/modulos/schema";
import type { ModuloFormState } from "@/app/admin/cursos/[id]/modulos/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function ModuloForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: ModuloFormState, formData: FormData) => Promise<ModuloFormState>;
  defaultValues?: Partial<ModuloFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ModuloFormState, FormData>(action, undefined);
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
        <Label htmlFor="numero">Número</Label>
        <Input
          id="numero"
          name="numero"
          type="number"
          min={1}
          defaultValue={values?.numero}
          required
        />
        {state?.errors?.numero && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.numero[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={values?.titulo} required />
        {state?.errors?.titulo && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.titulo[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" rows={4} defaultValue={values?.descricao} />
        {state?.errors?.descricao && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.descricao[0]}
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
