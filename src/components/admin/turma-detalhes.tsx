import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTelefone } from "@/lib/alunos/schema";
import {
  MATRICULA_STATUS_BADGE_CLASS,
  MATRICULA_STATUS_LABELS,
  type MatriculaStatus,
} from "@/lib/matriculas/schema";
import {
  TURMA_STATUS_BADGE_CLASS,
  TURMA_STATUS_LABELS,
  TURNO_LABELS,
  type TurmaWithCurso,
} from "@/lib/turmas/schema";

export type TurmaMatriculaAluno = {
  id: string;
  status: MatriculaStatus;
  alunos: { full_name: string | null; email: string; telefone: string } | null;
};

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC),
// mesmo padrão usado em turmas-table.tsx/matricula-detalhes.tsx.
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

// horario_aula vem do banco como "time" (ex.: "19:00:00"); horario_fim é
// texto livre já salvo como "HH:MM" — slice(0, 5) é inofensivo nos dois
// casos, só corta os segundos quando existem.
function formatHorario(inicio: string | null, fim: string | null): string {
  const inicioFmt = inicio?.slice(0, 5);
  const fimFmt = fim?.slice(0, 5);
  if (!inicioFmt && !fimFmt) return "—";
  if (inicioFmt && fimFmt) return `${inicioFmt} - ${fimFmt}`;
  return inicioFmt ?? fimFmt ?? "—";
}

// Sem estado/efeitos/handlers — só leitura e navegação via Link, então fica
// como Server Component (padrão do projeto; ver CLAUDE.md), diferente de
// matricula-detalhes.tsx, que precisa de "use client" pelo modo de edição.
export function TurmaDetalhes({
  turma,
  matriculas,
}: {
  turma: TurmaWithCurso;
  matriculas: TurmaMatriculaAluno[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href="/admin/turmas" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
        >
          <ArrowLeft />
          Voltar para turmas
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{turma.nome}</h1>
        <Badge className={TURMA_STATUS_BADGE_CLASS[turma.status]}>
          {TURMA_STATUS_LABELS[turma.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-muted-foreground">
            Curso: <span className="text-foreground">{turma.cursos?.nome ?? "—"}</span>
          </p>
          <p className="text-muted-foreground">
            Professor: <span className="text-foreground">{turma.professor ?? "—"}</span>
          </p>
          <p className="text-muted-foreground">
            Turno:{" "}
            <span className="text-foreground">
              {turma.turno ? TURNO_LABELS[turma.turno] : "—"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Local/Sala: <span className="text-foreground">{turma.local_sala ?? "—"}</span>
          </p>
          <p className="text-muted-foreground">
            Horário:{" "}
            <span className="text-foreground">
              {formatHorario(turma.horario_aula, turma.horario_fim)}
            </span>
          </p>
          <p className="text-muted-foreground">
            Período:{" "}
            <span className="text-foreground">
              {formatDataBR(turma.data_inicio)} → {formatDataBR(turma.data_fim)}
            </span>
          </p>
          <p className="text-muted-foreground">
            Vagas:{" "}
            <span className="text-foreground">
              {turma.vagas_ocupadas}/{turma.capacidade_maxima}
            </span>
          </p>
          {turma.observacoes && (
            <p className="text-muted-foreground sm:col-span-2">
              Observações: <span className="text-foreground">{turma.observacoes}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alunos matriculados</CardTitle>
        </CardHeader>
        <CardContent>
          {matriculas.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhum aluno matriculado nesta turma
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriculas.map((matricula) => (
                  <TableRow key={matricula.id}>
                    <TableCell className="font-medium">
                      {matricula.alunos?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>{matricula.alunos?.email ?? "—"}</TableCell>
                    <TableCell>
                      {matricula.alunos ? formatTelefone(matricula.alunos.telefone) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={MATRICULA_STATUS_BADGE_CLASS[matricula.status]}>
                        {MATRICULA_STATUS_LABELS[matricula.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={<Link href={`/admin/matriculas/${matricula.id}`} />}
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                      >
                        Ver matrícula
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
