"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { criarLeadPublico, type CaptacaoFormState } from "@/app/captacao/actions";
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
import { LEAD_ORIGENS, LEAD_ORIGEM_LABELS } from "@/lib/leads/schema";

type CursoOption = { id: string; nome: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Enviando..." : "Quero saber mais"}
    </Button>
  );
}

export function FormularioCaptacao({ cursos }: { cursos: CursoOption[] }) {
  const [state, formAction] = useActionState<CaptacaoFormState, FormData>(criarLeadPublico, undefined);
  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-medium">Recebemos seu interesse!</p>
        <p className="text-muted-foreground text-sm">
          Em breve alguém da nossa equipe vai entrar em contato pelo WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required />
        {state?.errors?.nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.nome[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="telefone">WhatsApp</Label>
        <Input id="telefone" name="telefone" type="tel" placeholder="(11) 99999-9999" required />
        {state?.errors?.telefone && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.telefone[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="curso_id">Curso de interesse</Label>
        <Select name="curso_id" items={cursoItems}>
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
        <Label htmlFor="origem">Como você ficou sabendo da gente?</Label>
        <Select name="origem" items={LEAD_ORIGEM_LABELS}>
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
        <Label htmlFor="observacoes">Mensagem (opcional)</Label>
        <Textarea id="observacoes" name="observacoes" rows={3} />
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
