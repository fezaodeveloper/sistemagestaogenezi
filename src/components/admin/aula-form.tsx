"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AulaFormValues } from "@/lib/aulas/schema";
import type { AulaFormState } from "@/app/admin/cursos/[id]/aulas/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function AulaForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: AulaFormState, formData: FormData) => Promise<AulaFormState>;
  defaultValues?: Partial<AulaFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<AulaFormState, FormData>(action, undefined);
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
        <Label htmlFor="conteudo">Conteúdo</Label>
        <Textarea id="conteudo" name="conteudo" defaultValue={values?.conteudo} rows={8} />
        {state?.errors?.conteudo && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.conteudo[0]}
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
