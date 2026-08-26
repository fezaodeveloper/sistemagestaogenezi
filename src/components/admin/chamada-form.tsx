"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRESENCA_STATUSES } from "@/lib/presencas/schema";
import {
  registrarPresencas,
  type RegistrarPresencasState,
} from "@/app/admin/turmas/[id]/presencas/actions";

type PresencaStatus = (typeof PRESENCA_STATUSES)[number];

type AlunoChamada = {
  matriculaId: string;
  nome: string;
  statusInicial: PresencaStatus;
  dataReposicaoInicial: string;
  justificativaInicial: string;
};

const STATUS_BOTAO_CONFIG: Record<PresencaStatus, { label: string; corSelecionada: string }> = {
  presente: {
    label: "Presente",
    corSelecionada: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  falta: {
    label: "Falta",
    corSelecionada: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  justificada: {
    label: "Justificada",
    corSelecionada: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  reposicao: {
    label: "Reposição",
    corSelecionada: "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
};

const CONTADOR_CONFIG: Record<PresencaStatus, { label: string; cor: string }> = {
  presente: { label: "presentes", cor: "text-green-600 dark:text-green-400" },
  falta: { label: "faltas", cor: "text-red-600 dark:text-red-400" },
  justificada: { label: "justificadas", cor: "text-amber-700 dark:text-amber-400" },
  reposicao: { label: "reposições", cor: "text-blue-600 dark:text-blue-400" },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? "Salvando..." : "Salvar chamada"}
    </Button>
  );
}

function ChamadaCard({
  aluno,
  status,
  onStatusChange,
}: {
  aluno: AlunoChamada;
  status: PresencaStatus;
  onStatusChange: (status: PresencaStatus) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-base font-medium">{aluno.nome}</p>

        <div className="flex flex-wrap gap-2">
          {PRESENCA_STATUSES.map((opcao) => {
            const selecionado = status === opcao;
            return (
              <button
                key={opcao}
                type="button"
                onClick={() => onStatusChange(opcao)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  selecionado
                    ? STATUS_BOTAO_CONFIG[opcao].corSelecionada
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {STATUS_BOTAO_CONFIG[opcao].label}
              </button>
            );
          })}
        </div>

        {/* O status de verdade vai pro FormData por aqui — os botões acima só
            controlam qual opção fica destacada (visual) e qual bloco extra
            aparece abaixo; não são <select>, então precisam desse input. */}
        <input type="hidden" name={`status_${aluno.matriculaId}`} value={status} readOnly />

        {status === "reposicao" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`data_reposicao-${aluno.matriculaId}`} className="text-xs">
              Data da reposição
            </Label>
            <Input
              id={`data_reposicao-${aluno.matriculaId}`}
              name={`data_reposicao_${aluno.matriculaId}`}
              type="date"
              defaultValue={aluno.dataReposicaoInicial}
              className="max-w-48"
            />
          </div>
        )}

        {status === "justificada" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`justificativa-${aluno.matriculaId}`} className="text-xs">
              Justificativa
            </Label>
            <Textarea
              id={`justificativa-${aluno.matriculaId}`}
              name={`justificativa_${aluno.matriculaId}`}
              rows={2}
              defaultValue={aluno.justificativaInicial}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChamadaForm({
  turmaId,
  aulaId,
  data,
  alunos,
}: {
  turmaId: string;
  aulaId: string;
  data: string;
  alunos: AlunoChamada[];
}) {
  const action = registrarPresencas.bind(null, turmaId, aulaId, data);
  const [state, formAction] = useActionState<RegistrarPresencasState, FormData>(action, undefined);

  const [statusPorAluno, setStatusPorAluno] = useState<Record<string, PresencaStatus>>(() =>
    Object.fromEntries(alunos.map((aluno) => [aluno.matriculaId, aluno.statusInicial])),
  );

  const contagem = useMemo(() => {
    const counts: Record<PresencaStatus, number> = {
      presente: 0,
      falta: 0,
      justificada: 0,
      reposicao: 0,
    };
    for (const status of Object.values(statusPorAluno)) {
      counts[status] += 1;
    }
    return counts;
  }, [statusPorAluno]);

  function handleStatusChange(matriculaId: string, status: PresencaStatus) {
    setStatusPorAluno((atual) => ({ ...atual, [matriculaId]: status }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 pb-4">
      <div className="bg-muted/50 flex flex-wrap gap-x-4 gap-y-1 rounded-md border px-4 py-2 text-sm">
        {PRESENCA_STATUSES.map((status) => (
          <span key={status}>
            <span className={cn("font-medium", CONTADOR_CONFIG[status].cor)}>
              {contagem[status]}
            </span>{" "}
            {CONTADOR_CONFIG[status].label}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {alunos.map((aluno) => (
          <ChamadaCard
            key={aluno.matriculaId}
            aluno={aluno}
            status={statusPorAluno[aluno.matriculaId]}
            onStatusChange={(status) => handleStatusChange(aluno.matriculaId, status)}
          />
        ))}
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm sticky bottom-0 border-t pt-3">
        <SubmitButton />
      </div>
    </form>
  );
}
