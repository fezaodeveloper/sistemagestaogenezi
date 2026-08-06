"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProvaFormState } from "@/app/admin/cursos/[id]/modulos/[moduloId]/prova/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function ProvaForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: ProvaFormState, formData: FormData) => Promise<ProvaFormState>;
  defaultValues?: {
    titulo?: string;
    nota_minima_ativa?: boolean;
    nota_minima_percentual?: number | string;
    tentativas_limitadas?: boolean;
    tentativas_maximas?: number | string;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ProvaFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs (e os useState abaixo) com os valores ecoados.
  const values = state?.values ?? defaultValues;
  const [notaMinimaAtiva, setNotaMinimaAtiva] = useState(values?.nota_minima_ativa ?? false);
  const [tentativasLimitadas, setTentativasLimitadas] = useState(
    values?.tentativas_limitadas ?? false,
  );

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={values?.titulo} required />
        {state?.errors?.titulo && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.titulo[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="nota_minima_ativa" className="font-normal">
            Exigir nota mínima para aprovação
          </Label>
          <Switch
            id="nota_minima_ativa"
            name="nota_minima_ativa"
            defaultChecked={values?.nota_minima_ativa ?? false}
            onCheckedChange={setNotaMinimaAtiva}
          />
        </div>
        {notaMinimaAtiva && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="nota_minima_percentual">Nota mínima (%)</Label>
            <Input
              id="nota_minima_percentual"
              name="nota_minima_percentual"
              type="number"
              min={1}
              max={100}
              defaultValue={values?.nota_minima_percentual}
            />
            {state?.errors?.nota_minima_percentual && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.nota_minima_percentual[0]}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="tentativas_limitadas" className="font-normal">
            Limitar número de tentativas
          </Label>
          <Switch
            id="tentativas_limitadas"
            name="tentativas_limitadas"
            defaultChecked={values?.tentativas_limitadas ?? false}
            onCheckedChange={setTentativasLimitadas}
          />
        </div>
        {tentativasLimitadas && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="tentativas_maximas">Tentativas máximas</Label>
            <Input
              id="tentativas_maximas"
              name="tentativas_maximas"
              type="number"
              min={1}
              defaultValue={values?.tentativas_maximas}
            />
            {state?.errors?.tentativas_maximas && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.tentativas_maximas[0]}
              </p>
            )}
          </div>
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
