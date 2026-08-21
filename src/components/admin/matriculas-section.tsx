"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import {
  createMatricula,
  deleteMatricula,
  updateMatriculaExpiracao,
  updateMatriculaStatus,
  type MatriculaFormState,
} from "@/app/admin/alunos/matriculas-actions";
import {
  MATRICULA_STATUSES,
  MATRICULA_STATUS_LABELS,
  type MatriculaWithTurma,
} from "@/lib/matriculas/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_BADGE_VARIANT = {
  ativa: "default",
  concluida: "secondary",
  cancelada: "destructive",
  inativa: "outline",
} as const;

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function MatriculaRow({ matricula, alunoId }: { matricula: MatriculaWithTurma; alunoId: string }) {
  const [isPending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dataExpiracao, setDataExpiracao] = useState(matricula.data_expiracao);
  const [expPending, startExpTransition] = useTransition();
  const [expError, setExpError] = useState<string | null>(null);

  function handleStatusChange(status: string | null) {
    if (!status) return;
    setStatusError(null);
    startTransition(async () => {
      const result = await updateMatriculaStatus(matricula.id, alunoId, status);
      if (result.error) setStatusError(result.error);
    });
  }

  function handleSalvarExpiracao() {
    setExpError(null);
    startExpTransition(async () => {
      const result = await updateMatriculaExpiracao(matricula.id, alunoId, dataExpiracao);
      if (result.error) setExpError(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMatricula(matricula.id, alunoId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <div
      className="flex flex-col gap-2 border-b py-3 last:border-b-0"
      data-turma-nome={matricula.turmas?.nome}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{matricula.turmas?.nome ?? "—"}</span>
          <span className="text-muted-foreground text-xs">
            Matriculado em {formatDateBR(matricula.data_matricula)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            key={matricula.status}
            items={MATRICULA_STATUS_LABELS}
            defaultValue={matricula.status}
            onValueChange={handleStatusChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATRICULA_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <Badge variant={STATUS_BADGE_VARIANT[status]}>
                    {MATRICULA_STATUS_LABELS[status]}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (nextOpen) setDeleteError(null);
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Excluir matrícula em ${matricula.turmas?.nome ?? ""}`}
                >
                  <Trash2 />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir matrícula</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a matrícula em &quot;{matricula.turmas?.nome}
                  &quot;? Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                <p role="alert" className="text-destructive text-sm">
                  {deleteError}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleDelete}
                >
                  {isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`expiracao-${matricula.id}`} className="text-muted-foreground text-xs">
          Expira em
        </Label>
        <Input
          id={`expiracao-${matricula.id}`}
          type="date"
          value={dataExpiracao}
          onChange={(e) => setDataExpiracao(e.target.value)}
          className="h-8 w-36"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={expPending || dataExpiracao === matricula.data_expiracao}
          onClick={handleSalvarExpiracao}
        >
          {expPending ? "Salvando..." : "Salvar"}
        </Button>
        {expError && (
          <p role="alert" className="text-destructive text-xs">
            {expError}
          </p>
        )}
      </div>

      {statusError && (
        <p role="alert" className="text-destructive text-sm">
          {statusError}
        </p>
      )}
    </div>
  );
}

function NovaMatriculaSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Matriculando..." : "Matricular"}
    </Button>
  );
}

function NovaMatriculaForm({
  alunoId,
  turmas,
}: {
  alunoId: string;
  turmas: { id: string; nome: string }[];
}) {
  const action = createMatricula.bind(null, alunoId);
  const [state, formAction] = useActionState<MatriculaFormState, FormData>(action, undefined);

  if (turmas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhuma turma ativa disponível no momento para matricular este aluno.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="turma_id">Turma</Label>
        <Select
          name="turma_id"
          items={Object.fromEntries(turmas.map((turma) => [turma.id, turma.nome]))}
        >
          <SelectTrigger id="turma_id" className="w-56">
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="data_matricula">Data da matrícula</Label>
        <Input
          id="data_matricula"
          name="data_matricula"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
        {state?.errors?.data_matricula && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.data_matricula[0]}
          </p>
        )}
      </div>

      <NovaMatriculaSubmitButton />

      {state?.error && (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function MatriculasSection({
  alunoId,
  matriculas,
  turmasDisponiveis,
}: {
  alunoId: string;
  matriculas: MatriculaWithTurma[];
  turmasDisponiveis: { id: string; nome: string }[];
}) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Matrículas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {matriculas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma matrícula ainda.</p>
        ) : (
          <div>
            {matriculas.map((matricula) => (
              <MatriculaRow key={matricula.id} matricula={matricula} alunoId={alunoId} />
            ))}
          </div>
        )}

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Nova matrícula</p>
          <NovaMatriculaForm alunoId={alunoId} turmas={turmasDisponiveis} />
        </div>
      </CardContent>
    </Card>
  );
}
