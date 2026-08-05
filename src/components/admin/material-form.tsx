"use client";

import { useActionState, useState } from "react";
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
import { MATERIAL_TIPOS, MATERIAL_TIPO_LABELS, MATERIAL_URL_LABELS } from "@/lib/materiais/schema";
import type { MaterialFormState } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/materiais/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function MaterialForm({
  action,
  defaultValues,
  submitLabel,
  isEdit = false,
}: {
  action: (state: MaterialFormState, formData: FormData) => Promise<MaterialFormState>;
  defaultValues?: {
    tipo?: (typeof MATERIAL_TIPOS)[number];
    titulo?: string;
    ordem?: number | string;
    url?: string;
  };
  submitLabel: string;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState<MaterialFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs não controlados (e o useState de tipo, que
  // reinicializa a partir de values?.tipo) com os valores ecoados.
  const values = state?.values ?? defaultValues;
  const [tipo, setTipo] = useState<(typeof MATERIAL_TIPOS)[number]>(
    (values?.tipo as (typeof MATERIAL_TIPOS)[number]) || "video_youtube",
  );

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo">Tipo</Label>
        <Select
          name="tipo"
          items={MATERIAL_TIPO_LABELS}
          defaultValue={values?.tipo || "video_youtube"}
          onValueChange={(value) => {
            if (value) setTipo(value as (typeof MATERIAL_TIPOS)[number]);
          }}
        >
          <SelectTrigger id="tipo" className="w-full">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {MATERIAL_TIPO_LABELS[t]}
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
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={values?.titulo} required />
        {state?.errors?.titulo && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.titulo[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ordem">Ordem de exibição</Label>
        <Input
          id="ordem"
          name="ordem"
          type="number"
          min={1}
          defaultValue={values?.ordem}
          required
        />
        {state?.errors?.ordem && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.ordem[0]}
          </p>
        )}
      </div>

      {tipo === "pdf" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="arquivo">Arquivo PDF</Label>
          <Input id="arquivo" name="arquivo" type="file" accept="application/pdf" />
          {isEdit && (
            <p className="text-muted-foreground text-sm">
              Deixe em branco para manter o arquivo atual.
            </p>
          )}
          {state?.errors?.arquivo && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.arquivo[0]}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="url">{MATERIAL_URL_LABELS[tipo]}</Label>
          <Input id="url" name="url" type="url" defaultValue={values?.url} required />
          {state?.errors?.url && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.url[0]}
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
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
