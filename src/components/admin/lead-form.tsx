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
import { LEAD_ORIGENS, LEAD_ORIGEM_LABELS, type LeadFormValues } from "@/lib/leads/schema";

type CursoOption = { id: string; nome: string };

export type LeadFormState =
  | {
      errors?: Partial<
        Record<"nome" | "telefone" | "curso_id" | "origem" | "observacoes", string[]>
      >;
      error?: string;
      values?: Partial<LeadFormValues>;
    }
  | undefined;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function LeadForm({
  action,
  defaultValues,
  submitLabel,
  cursos,
}: {
  action: (state: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  defaultValues?: Partial<LeadFormValues>;
  submitLabel: string;
  cursos: CursoOption[];
}) {
  const [state, formAction] = useActionState<LeadFormState, FormData>(action, undefined);
  const values = state?.values ?? defaultValues;
  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));

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
        <Label htmlFor="telefone">Telefone</Label>
        <Input id="telefone" name="telefone" defaultValue={values?.telefone} required />
        {state?.errors?.telefone && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.telefone[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="curso_id">Curso de interesse</Label>
        <Select name="curso_id" items={cursoItems} defaultValue={values?.curso_id || undefined}>
          <SelectTrigger id="curso_id" className="w-full">
            <SelectValue placeholder="Selecione o curso" />
          </SelectTrigger>
          <SelectContent>
            {cursos.map((curso) => (
              <SelectItem key={curso.id} value={curso.id}>
                {curso.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.errors?.curso_id && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.curso_id[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="origem">Como ficou sabendo</Label>
        <Select name="origem" items={LEAD_ORIGEM_LABELS} defaultValue={values?.origem || undefined}>
          <SelectTrigger id="origem" className="w-full">
            <SelectValue placeholder="Selecione uma opção" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_ORIGENS.map((origem) => (
              <SelectItem key={origem} value={origem}>
                {LEAD_ORIGEM_LABELS[origem]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state?.errors?.origem && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.origem[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={values?.observacoes} />
        {state?.errors?.observacoes && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.observacoes[0]}
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
