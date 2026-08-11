"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CursoResgateFormState } from "@/app/admin/cursos/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function CursoResgateForm({
  action,
  disponivelInicial,
  custoInicial,
}: {
  action: (state: CursoResgateFormState, formData: FormData) => Promise<CursoResgateFormState>;
  disponivelInicial: boolean;
  custoInicial: number | null;
}) {
  const [state, formAction] = useActionState<CursoResgateFormState, FormData>(action, undefined);
  const [disponivel, setDisponivel] = useState(disponivelInicial);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="disponivel_para_resgate"
          name="disponivel_para_resgate"
          checked={disponivel}
          onCheckedChange={(v) => setDisponivel(v === true)}
        />
        <Label htmlFor="disponivel_para_resgate" className="font-normal">
          Disponível como curso bônus (resgatável com créditos)
        </Label>
      </div>

      {disponivel && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="custo_creditos">Custo em créditos</Label>
          <Input
            id="custo_creditos"
            name="custo_creditos"
            type="number"
            min={1}
            step={1}
            defaultValue={custoInicial ?? undefined}
            className="max-w-40"
          />
          {state?.errors?.custo_creditos && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.custo_creditos[0]}
            </p>
          )}
        </div>
      )}

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
