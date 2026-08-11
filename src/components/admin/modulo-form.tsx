"use client";

import { useActionState, useState } from "react";
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
  capaAtualUrl,
  submitLabel,
}: {
  action: (state: ModuloFormState, formData: FormData) => Promise<ModuloFormState>;
  defaultValues?: Partial<ModuloFormValues>;
  capaAtualUrl?: string | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ModuloFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs não controlados com os valores ecoados.
  const values = state?.values ?? defaultValues;
  const [previewUrl, setPreviewUrl] = useState<string | null>(capaAtualUrl ?? null);

  function handleCapaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(arquivo ? URL.createObjectURL(arquivo) : (capaAtualUrl ?? null));
  }

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      encType="multipart/form-data"
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="capa">Capa (miniatura, proporção 16:9)</Label>
        <div className="flex items-start gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou foto já enviada em bucket público
            <img
              src={previewUrl}
              alt="Prévia da capa"
              className="aspect-video w-40 rounded-lg border object-cover"
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex aspect-video w-40 items-center justify-center rounded-lg border text-xs">
              Sem capa
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <Input
              id="capa"
              name="capa"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCapaChange}
            />
            <p className="text-muted-foreground text-xs">
              JPEG, PNG ou WebP, até 5MB. A imagem é recortada automaticamente em 16:9 — a prévia
              ao lado já mostra o enquadramento final.
              {capaAtualUrl && " Envie um novo arquivo pra substituir a capa atual."}
            </p>
          </div>
        </div>
        {state?.errors?.capa && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.capa[0]}
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
