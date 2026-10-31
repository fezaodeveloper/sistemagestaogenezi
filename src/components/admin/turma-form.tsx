"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DIAS_SEMANA,
  DIA_SEMANA_LABELS,
  TURMA_STATUSES,
  TURMA_STATUS_LABELS,
  TURNOS,
  TURNO_LABELS,
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
  cursoIdsVinculados,
}: {
  action: (state: TurmaFormState, formData: FormData) => Promise<TurmaFormState>;
  defaultValues?: Partial<TurmaFormValues>;
  submitLabel: string;
  cursos: CursoOption[];
  // TAREFA múltiplos cursos por turma (PARTE 2) — ids já vinculados (turma_cursos), em ordem;
  // o primeiro é o "curso principal" (turmas.curso_id, compatibilidade). Vazio/ausente = turma
  // nova, nenhum curso selecionado ainda.
  cursoIdsVinculados?: string[];
}) {
  const [state, formAction] = useActionState<TurmaFormState, FormData>(action, undefined);
  // Se a validação falhar, o formulário reaparece com defaultValue do mount
  // original — sem isso, o usuário perde tudo que digitou. Trocar a key força
  // o React a remontar os inputs não controlados com os valores ecoados.
  const values = state?.values ?? defaultValues;

  // Múltiplos cursos (TAREFA, PARTE 2): lista ordenada de ids — o primeiro é sempre o "curso
  // principal" (vai pra turmas.curso_id, compatibilidade com o código legado). Substitui o
  // antigo <Select> único de curso_id por chips removíveis + "Adicionar curso...".
  const [cursoIds, setCursoIds] = useState<string[]>(state?.values?.curso_ids ?? cursoIdsVinculados ?? []);
  const cursosVinculados = cursoIds.map((id) => cursos.find((c) => c.id === id)).filter((c): c is CursoOption => !!c);
  const cursosDisponiveis = cursos.filter((c) => !cursoIds.includes(c.id));

  function adicionarCurso(id: string) {
    if (!id || cursoIds.includes(id)) return;
    setCursoIds((prev) => [...prev, id]);
  }

  function removerCurso(id: string) {
    setCursoIds((prev) => prev.filter((cursoId) => cursoId !== id));
  }

  // O bloco de cadência só aparece pra curso presencial/híbrido — precisa saber o tipo do curso
  // PRINCIPAL (primeiro da lista) em tempo real, não só no mount.
  const cursoSelecionado = cursos.find((curso) => curso.id === cursoIds[0]);
  const mostrarCadencia = !!cursoSelecionado && cursoSelecionado.tipo !== "ead";

  const [diasSelecionados, setDiasSelecionados] = useState<string[]>(
    values?.cadencia_dias_semana ?? [],
  );

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Cursos desta turma</Label>
            {/* Hidden inputs: FormData.getAll("curso_ids") no servidor — mesmo padrão de
                cadencia_dias_semana (Checkbox com name repetido) só que via inputs ocultos, já
                que a lista é controlada pelos chips, não por um grupo de checkbox marcado. */}
            {cursoIds.map((id) => (
              <input key={id} type="hidden" name="curso_ids" value={id} />
            ))}
            {cursosVinculados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cursosVinculados.map((curso, index) => (
                  <Badge key={curso.id} variant={index === 0 ? "default" : "outline"} className="gap-1 pr-1">
                    {curso.nome}
                    {index === 0 && cursosVinculados.length > 1 && <span className="text-[10px] opacity-70">(principal)</span>}
                    <button type="button" onClick={() => removerCurso(curso.id)} aria-label={`Remover ${curso.nome}`} className="hover:opacity-70">
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {cursosDisponiveis.length > 0 && (
              <Select items={Object.fromEntries(cursosDisponiveis.map((c) => [c.id, c.nome]))} value="" onValueChange={(v) => v && adicionarCurso(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Adicionar curso..." />
                </SelectTrigger>
                <SelectContent>
                  {cursosDisponiveis.map((curso) => (
                    <SelectItem key={curso.id} value={curso.id}>
                      {curso.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {cursoIds.length === 0 && (
              <p className="text-muted-foreground text-xs">Selecione ao menos um curso.</p>
            )}
            {state?.errors?.curso_ids && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.curso_ids[0]}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Período e vagas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
            <Label htmlFor="capacidade_maxima">Número de vagas</Label>
            <Input
              id="capacidade_maxima"
              name="capacidade_maxima"
              type="number"
              min={1}
              defaultValue={values?.capacidade_maxima}
              className="max-w-40"
              required
            />
            {state?.errors?.capacidade_maxima && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.capacidade_maxima[0]}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Horários e local</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="turno">Turno</Label>
              <Select name="turno" items={TURNO_LABELS} defaultValue={values?.turno || undefined}>
                <SelectTrigger id="turno" className="w-full">
                  <SelectValue placeholder="Selecione o turno" />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map((turno) => (
                    <SelectItem key={turno} value={turno}>
                      {TURNO_LABELS[turno]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="local_sala">Local / Sala</Label>
              <Input
                id="local_sala"
                name="local_sala"
                placeholder="Ex.: Sala 01, Laboratório"
                defaultValue={values?.local_sala ?? ""}
              />
              {state?.errors?.local_sala && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.local_sala[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="professor">Professor</Label>
            <Input
              id="professor"
              name="professor"
              placeholder="Nome do professor responsável"
              defaultValue={values?.professor ?? ""}
            />
            {state?.errors?.professor && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.professor[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telegram_chat_id">ID do chat do professor no Telegram</Label>
            <Input
              id="telegram_chat_id"
              name="telegram_chat_id"
              placeholder="Ex.: 123456789"
              defaultValue={values?.telegram_chat_id ?? ""}
            />
            <p className="text-muted-foreground text-sm">
              ID do chat no Telegram (para receber lembretes automáticos). Opcional — sem ele, o
              aviso de presença continua sendo enviado só pro chat administrativo.
            </p>
            {state?.errors?.telegram_chat_id && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.telegram_chat_id[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="horario_aula">Horário de início</Label>
              <Input
                id="horario_aula"
                name="horario_aula"
                type="time"
                defaultValue={values?.horario_aula ?? ""}
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
          <p className="text-muted-foreground text-sm">
            Horários opcionais. Usados nas mensagens automáticas de WhatsApp (matrícula criada e
            lembrete de aula).
          </p>

          {mostrarCadencia && (
            <div className="flex flex-col gap-2">
              <Label>Dias da semana</Label>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            placeholder="Opcional"
            defaultValue={values?.observacoes ?? ""}
          />
          {state?.errors?.observacoes && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.observacoes[0]}
            </p>
          )}
        </CardContent>
      </Card>
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm md:col-span-2">
          {state.error}
        </p>
      )}

      <div className="md:col-span-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
