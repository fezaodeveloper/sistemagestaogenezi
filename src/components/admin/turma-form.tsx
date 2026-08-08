"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DIAS_SEMANA,
  DIA_SEMANA_LABELS,
  TURMA_STATUSES,
  TURMA_STATUS_LABELS,
  type TurmaFormValues,
} from "@/lib/turmas/schema";
import type { TurmaFormState } from "@/app/admin/turmas/actions";

type CursoOption = { id: string; nome: string; tipo: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function TurmaForm({
  action,
  defaultValues,
  submitLabel,
  cursos,
}: {
  action: (state: TurmaFormState, formData: FormData) => Promise<TurmaFormState>;
  defaultValues?: Partial<TurmaFormValues>;
  submitLabel: string;
  cursos: CursoOption[];
}) {
  const [state, formAction] = useActionState<TurmaFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs não controlados com os valores ecoados.
  const values = state?.values ?? defaultValues;
  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));

  // O bloco de cadência só aparece pra curso presencial/híbrido — precisa
  // saber o tipo do curso selecionado em tempo real (não só no mount), daí
  // o Select de curso ser controlado por esse estado via onValueChange.
  const [cursoId, setCursoId] = useState(values?.curso_id ?? "");
  const cursoSelecionado = cursos.find((curso) => curso.id === cursoId);
  const mostrarCadencia = !!cursoSelecionado && cursoSelecionado.tipo !== "ead";

  const [diasSelecionados, setDiasSelecionados] = useState<string[]>(
    values?.cadencia_dias_semana ?? [],
  );

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="curso_id">Curso</Label>
        <Select
          name="curso_id"
          items={cursoItems}
          defaultValue={values?.curso_id || undefined}
          onValueChange={(value) => setCursoId(String(value))}
        >
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
        <Label htmlFor="nome">Nome da turma</Label>
        <Input id="nome" name="nome" defaultValue={values?.nome} required />
        {state?.errors?.nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.nome[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="data_inicio">Início</Label>
          <Input
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={values?.data_inicio}
            required
          />
          {state?.errors?.data_inicio && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.data_inicio[0]}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="data_fim">Término</Label>
          <Input
            id="data_fim"
            name="data_fim"
            type="date"
            defaultValue={values?.data_fim}
            required
          />
          {state?.errors?.data_fim && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.data_fim[0]}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="capacidade_maxima">Capacidade máxima</Label>
        <Input
          id="capacidade_maxima"
          name="capacidade_maxima"
          type="number"
          min={1}
          defaultValue={values?.capacidade_maxima}
          required
        />
        {state?.errors?.capacidade_maxima && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.capacidade_maxima[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select
          name="status"
          items={TURMA_STATUS_LABELS}
          defaultValue={values?.status || "planejada"}
        >
          <SelectTrigger id="status" className="w-full">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            {TURMA_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {TURMA_STATUS_LABELS[status]}
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

      {mostrarCadencia && (
        <div className="flex flex-col gap-2">
          <Label>Cadência de liberação</Label>
          <p className="text-muted-foreground text-sm">
            Dias da semana em que novas aulas são liberadas no cronograma da turma.
          </p>
          <div className="flex flex-wrap gap-4">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia} className="flex items-center gap-2">
                <Checkbox
                  id={`dia-${dia}`}
                  name="cadencia_dias_semana"
                  value={dia}
                  checked={diasSelecionados.includes(dia)}
                  onCheckedChange={(checked) =>
                    setDiasSelecionados((prev) =>
                      checked ? [...prev, dia] : prev.filter((d) => d !== dia),
                    )
                  }
                />
                <Label htmlFor={`dia-${dia}`} className="font-normal">
                  {DIA_SEMANA_LABELS[dia]}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {diasSelecionados.length === 0
              ? "Nenhum dia selecionado."
              : `${diasSelecionados.length}x por semana.`}
          </p>
          {state?.errors?.cadencia_dias_semana && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.cadencia_dias_semana[0]}
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
