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
  capaAtualUrl,
  submitLabel,
}: {
  action: (state: CursoFormState, formData: FormData) => Promise<CursoFormState>;
  defaultValues?: Partial<CursoFormValues>;
  capaAtualUrl?: string | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<CursoFormState, FormData>(action, undefined);
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
        <Label htmlFor="carga_horaria_horas">Carga horária (horas)</Label>
        <Input
          id="carga_horaria_horas"
          name="carga_horaria_horas"
          type="number"
          min={1}
          defaultValue={values?.carga_horaria_horas}
          className="max-w-32"
        />
        <p className="text-muted-foreground text-xs">
          Opcional — usada na variável {"{carga_horaria}"} do certificado de conclusão.
        </p>
        {state?.errors?.carga_horaria_horas && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.carga_horaria_horas[0]}
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="capa">Capa (pôster, proporção 2:3)</Label>
        <div className="flex items-start gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou foto já enviada em bucket público
            <img
              src={previewUrl}
              alt="Prévia da capa"
              className="aspect-2/3 w-24 rounded-lg border object-cover"
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex aspect-2/3 w-24 items-center justify-center rounded-lg border text-xs">
              Sem capa
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <Input id="capa" name="capa" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCapaChange} />
            <p className="text-muted-foreground text-xs">
              JPEG, PNG ou WebP, até 5MB. A imagem é recortada automaticamente em 2:3 — a prévia
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
