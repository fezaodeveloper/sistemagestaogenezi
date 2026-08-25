"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ABRANGENCIA_LABELS,
  ABRANGENCIA_OPTIONS,
  EVENTO_TIPOS,
  EVENTO_TIPO_LABELS,
  TIPO_FERIADO_LABELS,
  TIPO_FERIADO_OPTIONS,
  type Abrangencia,
  type EventoFormValues,
  type EventoTipo,
} from "@/lib/calendario/schema";
import type { EventoFormState } from "@/app/admin/calendario/actions";

type CursoOption = { id: string; nome: string };
type TurmaOption = { id: string; nome: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function EventoForm({
  action,
  defaultValues,
  submitLabel,
  cursos,
  turmas,
}: {
  action: (state: EventoFormState, formData: FormData) => Promise<EventoFormState>;
  defaultValues?: Partial<EventoFormValues>;
  submitLabel: string;
  cursos: CursoOption[];
  turmas: TurmaOption[];
}) {
  const [state, formAction] = useActionState<EventoFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — trocar a key força o React a remontar os inputs não
  // controlados com os valores ecoados (mesmo padrão de turma-form.tsx).
  const values = state?.values ?? defaultValues;

  const [tipo, setTipo] = useState<EventoTipo>((values?.tipo as EventoTipo | undefined) ?? "evento");
  const [abrangencia, setAbrangencia] = useState<Abrangencia>(
    (values?.abrangencia as Abrangencia | undefined) ?? "todos",
  );

  const cursoItems = Object.fromEntries(cursos.map((curso) => [curso.id, curso.nome]));
  const turmaItems = Object.fromEntries(turmas.map((turma) => [turma.id, turma.nome]));

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-2xl flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Evento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome do evento</Label>
            <Input id="nome" name="nome" defaultValue={values?.nome} required />
            {state?.errors?.nome && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.nome[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              name="tipo"
              items={EVENTO_TIPO_LABELS}
              defaultValue={values?.tipo || "evento"}
              onValueChange={(value) => setTipo(value as EventoTipo)}
            >
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {EVENTO_TIPOS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {EVENTO_TIPO_LABELS[opcao]}
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

          {tipo === "feriado" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo_feriado">Tipo de feriado</Label>
              <Select
                name="tipo_feriado"
                items={TIPO_FERIADO_LABELS}
                defaultValue={values?.tipo_feriado || undefined}
              >
                <SelectTrigger id="tipo_feriado" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_FERIADO_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {TIPO_FERIADO_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.errors?.tipo_feriado && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.tipo_feriado[0]}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data e horário</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_inicio">Data de início</Label>
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
              <Label htmlFor="data_fim">Data de término</Label>
              <Input id="data_fim" name="data_fim" type="date" defaultValue={values?.data_fim ?? ""} />
              <p className="text-muted-foreground text-xs">
                Opcional — se vazio, assume a mesma data de início.
              </p>
              {state?.errors?.data_fim && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.data_fim[0]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="horario_inicio">Horário de início</Label>
              <Input
                id="horario_inicio"
                name="horario_inicio"
                type="time"
                defaultValue={values?.horario_inicio ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="horario_fim">Horário de término</Label>
              <Input
                id="horario_fim"
                name="horario_fim"
                type="time"
                defaultValue={values?.horario_fim ?? ""}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Horários opcionais.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abrangência</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RadioGroup
            name="abrangencia"
            value={abrangencia}
            onValueChange={(value) => setAbrangencia(value as Abrangencia)}
            className="flex flex-col gap-2"
          >
            {ABRANGENCIA_OPTIONS.map((opcao) => (
              <div key={opcao} className="flex items-center gap-2">
                <RadioGroupItem value={opcao} id={`abrangencia-${opcao}`} />
                <Label htmlFor={`abrangencia-${opcao}`} className="font-normal">
                  {ABRANGENCIA_LABELS[opcao]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {state?.errors?.abrangencia && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.abrangencia[0]}
            </p>
          )}

          {abrangencia === "curso" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="curso_id">Curso</Label>
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
          )}

          {abrangencia === "turma" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="turma_id">Turma</Label>
              <Select name="turma_id" items={turmaItems} defaultValue={values?.turma_id || undefined}>
                <SelectTrigger id="turma_id" className="w-full">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((turma) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state?.errors?.turma_id && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.turma_id[0]}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impactos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="gera_notificacao" className="font-normal">
              Gera notificação
            </Label>
            <Switch
              id="gera_notificacao"
              name="gera_notificacao"
              defaultChecked={values?.gera_notificacao ?? false}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="impacta_aulas" className="font-normal">
              Impacta aulas
            </Label>
            <Switch
              id="impacta_aulas"
              name="impacta_aulas"
              defaultChecked={values?.impacta_aulas ?? false}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="bloqueia_frequencia" className="font-normal">
              Bloqueia frequência
            </Label>
            <Switch
              id="bloqueia_frequencia"
              name="bloqueia_frequencia"
              defaultChecked={values?.bloqueia_frequencia ?? false}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            placeholder="Opcional"
            defaultValue={values?.observacoes ?? ""}
          />
        </CardContent>
      </Card>

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
