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
import { CURSO_STATUSES, CURSO_STATUS_LABELS, type CursoGratuitoFormValues } from "@/lib/cursos/schema";
import type { CursoGratuitoFormState } from "@/app/admin/cursos-gratuitos/actions";

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
}: {
  action: (state: CursoGratuitoFormState, formData: FormData) => Promise<CursoGratuitoFormState>;
  defaultValues?: Partial<CursoGratuitoFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<CursoGratuitoFormState, FormData>(action, undefined);
  const values = state?.values ?? defaultValues;

  return (
    <form key={JSON.stringify(state?.values)} action={formAction} className="flex max-w-xl flex-col gap-4">
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
