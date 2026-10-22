"use client";

import { useActionState, useState, useTransition } from "react";
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
import { CURSO_STATUSES, CURSO_STATUS_LABELS, type CursoGratuitoFormValues } from "@/lib/cursos/schema";
import { removerFotoCursoGratuito, type CursoGratuitoFormState } from "@/app/admin/cursos-gratuitos/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function CursoGratuitoForm({
  action,
  defaultValues,
  submitLabel,
  // Só preenchidos na edição (há um curso já existente) — na criação não há foto pra mostrar
  // nem remover ainda.
  cursoId,
  fotoAtualUrl,
}: {
  action: (state: CursoGratuitoFormState, formData: FormData) => Promise<CursoGratuitoFormState>;
  defaultValues?: Partial<CursoGratuitoFormValues>;
  submitLabel: string;
  cursoId?: string;
  fotoAtualUrl?: string | null;
}) {
  const [state, formAction] = useActionState<CursoGratuitoFormState, FormData>(action, undefined);
  const values = state?.values ?? defaultValues;
  const [previewUrl, setPreviewUrl] = useState<string | null>(fotoAtualUrl ?? null);
  const [isRemovendoFoto, startRemoverFoto] = useTransition();
  const [erroRemoverFoto, setErroRemoverFoto] = useState<string | null>(null);

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(arquivo ? URL.createObjectURL(arquivo) : (fotoAtualUrl ?? null));
  }

  function handleRemoverFoto() {
    if (!cursoId) return;
    setErroRemoverFoto(null);
    startRemoverFoto(async () => {
      const resultado = await removerFotoCursoGratuito(cursoId);
      if (resultado.error) {
        setErroRemoverFoto(resultado.error);
        return;
      }
      setPreviewUrl(null);
    });
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
        <Label htmlFor="url_plataforma_externa">URL da plataforma externa</Label>
        <Input
          id="url_plataforma_externa"
          name="url_plataforma_externa"
          type="url"
          placeholder="https://plataforma.com/curso"
          defaultValue={values?.url_plataforma_externa}
          required
        />
        <p className="text-muted-foreground text-xs">
          Link para onde o aluno será redirecionado ao clicar em &quot;Acessar Curso&quot; no portal.
        </p>
        {state?.errors?.url_plataforma_externa && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.url_plataforma_externa[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="carga_horaria">Carga horária</Label>
        <Input
          id="carga_horaria"
          name="carga_horaria"
          placeholder="Ex.: 40h"
          defaultValue={values?.carga_horaria}
          className="max-w-32"
        />
        {state?.errors?.carga_horaria && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.carga_horaria[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="foto">Foto do curso</Label>
        <div className="flex items-start gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou foto já enviada em bucket público
            <img src={previewUrl} alt="Prévia da foto" className="aspect-square w-20 rounded-lg border object-cover" />
          ) : (
            <div className="bg-muted text-muted-foreground flex aspect-square w-20 items-center justify-center rounded-lg border text-xs">
              Sem foto
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <Input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoChange} />
            <p className="text-muted-foreground text-xs">
              JPEG, PNG ou WebP, até 5MB.
              {fotoAtualUrl && " Envie um novo arquivo pra substituir a foto atual."}
            </p>
            {cursoId && fotoAtualUrl && previewUrl === fotoAtualUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={isRemovendoFoto}
                onClick={handleRemoverFoto}
              >
                {isRemovendoFoto ? "Removendo..." : "Remover foto"}
              </Button>
            )}
            {erroRemoverFoto && (
              <p role="alert" className="text-destructive text-xs">
                {erroRemoverFoto}
              </p>
            )}
          </div>
        </div>
        {state?.errors?.foto && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.foto[0]}
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
