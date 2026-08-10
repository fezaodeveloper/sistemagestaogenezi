"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import { liberarAula, liberarModulo } from "@/app/admin/alunos/liberacoes-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CursoOption = { id: string; nome: string; matriculaId: string };
type AulaOption = { id: string; numero: number; titulo: string };
type ModuloOption = {
  id: string;
  numero: number;
  titulo: string;
  cursoId: string;
  aulas: AulaOption[];
};
type LiberacaoExistente = {
  id: string;
  aulaId: string;
  cursoNome: string;
  moduloNumero: number;
  moduloTitulo: string;
  aulaNumero: number;
  aulaTitulo: string;
  createdAt: string;
};

function formatDateBR(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

function LiberarAulaButton({
  alunoId,
  matriculaId,
  aula,
  jaLiberada,
}: {
  alunoId: string;
  matriculaId: string;
  aula: AulaOption;
  jaLiberada: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (jaLiberada) {
    return (
      <Badge variant="secondary" className="gap-1">
        <LockOpen className="size-3" />
        Liberada
      </Badge>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await liberarAula(alunoId, matriculaId, aula.id);
            if (result.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Liberando..." : "Liberar esta aula"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

function LiberarModuloButton({
  alunoId,
  matriculaId,
  moduloId,
}: {
  alunoId: string;
  matriculaId: string;
  moduloId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await liberarModulo(alunoId, matriculaId, moduloId);
            if (result.error) setError(result.error);
          });
        }}
      >
        <Lock />
        {isPending ? "Liberando..." : "Liberar módulo inteiro"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export function LiberacoesManuaisSection({
  alunoId,
  cursos,
  modulos,
  liberacoes,
}: {
  alunoId: string;
  cursos: CursoOption[];
  modulos: ModuloOption[];
  liberacoes: LiberacaoExistente[];
}) {
  const [cursoId, setCursoId] = useState(cursos[0]?.id ?? "");
  const cursoSelecionado = cursos.find((c) => c.id === cursoId);
  const modulosDoCurso = modulos.filter((m) => m.cursoId === cursoId);
  const aulasLiberadasIds = useMemo(() => new Set(liberacoes.map((l) => l.aulaId)), [liberacoes]);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Liberações manuais</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Libera uma aula específica ou um módulo inteiro pra esse aluno, ignorando calendário e
          sequência — só pra ele, permanentemente.
        </p>

        {cursos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Este aluno não tem matrícula em nenhum curso ainda.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="liberacao_curso">Curso</Label>
              <Select
                items={Object.fromEntries(cursos.map((c) => [c.id, c.nome]))}
                defaultValue={cursoId || undefined}
                onValueChange={(value) => setCursoId(String(value))}
              >
                <SelectTrigger id="liberacao_curso" className="w-full">
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cursoSelecionado && (
              <div className="flex flex-col gap-3">
                {modulosDoCurso.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Este curso ainda não tem módulos cadastrados.
                  </p>
                ) : (
                  modulosDoCurso.map((modulo) => (
                    <div key={modulo.id} className="flex flex-col gap-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          Módulo {modulo.numero} — {modulo.titulo}
                        </p>
                        <LiberarModuloButton
                          alunoId={alunoId}
                          matriculaId={cursoSelecionado.matriculaId}
                          moduloId={modulo.id}
                        />
                      </div>
                      {modulo.aulas.length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                          Nenhuma aula neste módulo ainda.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5 pl-2">
                          {modulo.aulas.map((aula) => (
                            <div
                              key={aula.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                Aula {aula.numero} — {aula.titulo}
                              </span>
                              <LiberarAulaButton
                                alunoId={alunoId}
                                matriculaId={cursoSelecionado.matriculaId}
                                aula={aula}
                                jaLiberada={aulasLiberadasIds.has(aula.id)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Liberações já concedidas</p>
          {liberacoes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma liberação manual ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {liberacoes.map((l) => (
                <div key={l.id} className="flex flex-col text-sm">
                  <span>
                    {l.cursoNome} — Módulo {l.moduloNumero} ({l.moduloTitulo}) — Aula {l.aulaNumero}{" "}
                    ({l.aulaTitulo})
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Liberado em {formatDateBR(l.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
