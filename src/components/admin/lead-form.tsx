"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { buscarLeadDuplicado } from "@/app/admin/leads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
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
type CampanhaOption = { id: string; nome: string };
type ResponsavelOption = { id: string; nome: string };

export type LeadFormState =
  | {
      errors?: Partial<
        Record<
          "nome" | "telefone" | "curso_id" | "origem" | "observacoes" | "email" | "campanha_id" | "responsavel_id" | "proximo_contato",
          string[]
        >
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

// "*" vermelho nos campos obrigatórios (TAREFA).
function LabelObrigatorio({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

export function LeadForm({
  action,
  defaultValues,
  submitLabel,
  cursos,
  campanhas,
  responsaveis,
  leadIdAtual,
}: {
  action: (state: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  defaultValues?: Partial<LeadFormValues>;
  submitLabel: string;
  cursos: CursoOption[];
  campanhas: CampanhaOption[];
  responsaveis: ResponsavelOption[];
  // Id do próprio lead, na edição — exclui ele mesmo da busca de duplicados.
  leadIdAtual?: string;
}) {
  const [state, formAction] = useActionState<LeadFormState, FormData>(action, undefined);
  const values = state?.values ?? defaultValues;
  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));
  const campanhaItems = Object.fromEntries(campanhas.map((c) => [c.id, c.nome]));
  const responsavelItems = Object.fromEntries(responsaveis.map((r) => [r.id, r.nome]));

  const [telefone, setTelefone] = useState(values?.telefone ?? "");
  const [duplicado, setDuplicado] = useState<{ id: string; nome: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TAREFA: debounce 500ms — ao digitar o WhatsApp, avisa se já existe lead com esse número.
  // queueMicrotask no setState síncrono (react-hooks/set-state-in-effect), mesmo padrão já usado
  // no drawer de leads pra reidratação de campos.
  useEffect(() => {
    queueMicrotask(() => setDuplicado(null));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10) return;

    debounceRef.current = setTimeout(() => {
      buscarLeadDuplicado(telefone, leadIdAtual).then(setDuplicado);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [telefone, leadIdAtual]);

  return (
    <form key={JSON.stringify(state?.values)} action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <LabelObrigatorio htmlFor="nome">Nome completo</LabelObrigatorio>
        <Input id="nome" name="nome" defaultValue={values?.nome} required />
        {state?.errors?.nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.nome[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <LabelObrigatorio htmlFor="telefone">WhatsApp</LabelObrigatorio>
        <TelefoneInput id="telefone" name="telefone" value={telefone} onValueChange={setTelefone} required />
        {duplicado && (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            ⚠️ Lead existente: {duplicado.nome} —{" "}
            <Link href={`/admin/leads/${duplicado.id}/editar`} className="underline underline-offset-2">
              Ver cadastro
            </Link>
          </p>
        )}
        {state?.errors?.telefone && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.telefone[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={values?.email} placeholder="Opcional" />
        {state?.errors?.email && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.email[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <LabelObrigatorio htmlFor="curso_id">Curso de interesse</LabelObrigatorio>
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
        <LabelObrigatorio htmlFor="origem">Como ficou sabendo</LabelObrigatorio>
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
        <Label htmlFor="campanha_id">Campanha</Label>
        <Select name="campanha_id" items={campanhaItems} defaultValue={values?.campanha_id || undefined}>
          <SelectTrigger id="campanha_id" className="w-full">
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            {campanhas.map((campanha) => (
              <SelectItem key={campanha.id} value={campanha.id}>
                {campanha.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="responsavel_id">Responsável</Label>
        <Select name="responsavel_id" items={responsavelItems} defaultValue={values?.responsavel_id || undefined}>
          <SelectTrigger id="responsavel_id" className="w-full">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {responsaveis.map((responsavel) => (
              <SelectItem key={responsavel.id} value={responsavel.id}>
                {responsavel.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="proximo_contato">Próximo contato</Label>
        <Input
          id="proximo_contato"
          name="proximo_contato"
          type="datetime-local"
          defaultValue={values?.proximo_contato}
        />
        {state?.errors?.proximo_contato && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.proximo_contato[0]}
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
