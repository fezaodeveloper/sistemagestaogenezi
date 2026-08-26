"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { TurmaFrequenciaPdf } from "@/components/admin/turma-frequencia-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FREQUENCIA_MINIMA_PERCENTUAL as FREQUENCIA_MINIMA,
  FREQUENCIA_STATUS_BADGE_CLASS as FREQUENCIA_BADGE_CLASS,
  PRESENCA_STATUSES,
} from "@/lib/presencas/schema";
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

type PresencaStatus = (typeof PRESENCA_STATUSES)[number];

export type TurmaPresencaRow = {
  matricula_id: string;
  status: PresencaStatus;
};

type FrequenciaAluno = {
  matriculaId: string;
  nome: string;
  totalAulas: number;
  presencas: number;
  faltas: number;
  percentual: number;
  apto: boolean;
};

// "Presenças" conta presente+reposição; "Faltas" conta falta+justificada —
// justificativa evita a mensagem automática de falta (ver enviarMensagemFalta
// em registrarPresencas), mas continua contando contra a frequência.
function calcularFrequencias(
  matriculas: TurmaMatriculaAluno[],
  presencas: TurmaPresencaRow[],
): FrequenciaAluno[] {
  return matriculas.map((matricula) => {
    const doAluno = presencas.filter((presenca) => presenca.matricula_id === matricula.id);
    const totalAulas = doAluno.length;
    const presentes = doAluno.filter(
      (presenca) => presenca.status === "presente" || presenca.status === "reposicao",
    ).length;
    const faltas = doAluno.filter(
      (presenca) => presenca.status === "falta" || presenca.status === "justificada",
    ).length;
    const percentual = totalAulas > 0 ? Math.round((presentes / totalAulas) * 100) : 0;

    return {
      matriculaId: matricula.id,
      nome: matricula.alunos?.full_name || matricula.alunos?.email || "—",
      totalAulas,
      presencas: presentes,
      faltas,
      percentual,
      apto: percentual >= FREQUENCIA_MINIMA,
    };
  });
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar
// `new Date(...)` direto numa string de data pura (interpretada como UTC),
// mesmo padrão usado em turmas-table.tsx/matricula-detalhes.tsx.
function formatDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
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

export function TurmaDetalhes({
  turma,
  matriculas,
  presencas,
}: {
  turma: TurmaWithCurso;
  matriculas: TurmaMatriculaAluno[];
  presencas: TurmaPresencaRow[];
}) {
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const frequencias = calcularFrequencias(matriculas, presencas);
  const temPresencas = presencas.length > 0;

  async function handleExportarRelatorio() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes
    // de qualquer await — mesmo padrão de matricula-detalhes.tsx/turmas-table.tsx.
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    try {
      const geradoEm = formatDataHora(new Date().toISOString());
      const blob = await pdf(
        <TurmaFrequenciaPdf turma={turma} frequencias={frequencias} geradoEm={geradoEm} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } finally {
      setGerandoPdf(false);
    }
  }

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{turma.nome}</h1>
          <Badge className={TURMA_STATUS_BADGE_CLASS[turma.status]}>
            {TURMA_STATUS_LABELS[turma.status]}
          </Badge>
        </div>
        <Button render={<Link href={`/admin/turmas/${turma.id}/editar`} />} nativeButton={false}>
          <Pencil />
          Editar turma
        </Button>
      </div>

      <Tabs defaultValue="informacoes">
        <TabsList>
          <TabsTrigger value="informacoes">Informações</TabsTrigger>
          <TabsTrigger value="alunos">Alunos matriculados</TabsTrigger>
          <TabsTrigger value="frequencia">Relatório de frequência</TabsTrigger>
        </TabsList>

        <TabsContent value="informacoes">
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
        </TabsContent>

        <TabsContent value="alunos">
          <Card>
            <CardHeader>
              <CardTitle>Alunos matriculados</CardTitle>
              <p className="text-muted-foreground text-sm">
                {matriculas.length} aluno(s) matriculado(s)
              </p>
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
                        <TableCell className="flex justify-end gap-1 text-right">
                          <Button
                            render={<Link href={`/admin/turmas/${turma.id}/alunos/${matricula.id}`} />}
                            nativeButton={false}
                            variant="ghost"
                            size="sm"
                          >
                            Histórico
                          </Button>
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
        </TabsContent>

        <TabsContent value="frequencia">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Relatório de frequência</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportarRelatorio}
                disabled={gerandoPdf || !temPresencas}
              >
                <Printer />
                {gerandoPdf ? "Gerando PDF..." : "Exportar relatório PDF"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!temPresencas ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Nenhuma chamada registrada ainda
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Total de aulas</TableHead>
                        <TableHead>Presenças</TableHead>
                        <TableHead>Faltas</TableHead>
                        <TableHead>% Frequência</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {frequencias.map((aluno) => (
                        <TableRow key={aluno.matriculaId}>
                          <TableCell className="font-medium">{aluno.nome}</TableCell>
                          <TableCell>{aluno.totalAulas}</TableCell>
                          <TableCell>{aluno.presencas}</TableCell>
                          <TableCell>{aluno.faltas}</TableCell>
                          <TableCell>{aluno.percentual}%</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                aluno.apto
                                  ? FREQUENCIA_BADGE_CLASS.apto
                                  : FREQUENCIA_BADGE_CLASS.inapto
                              }
                            >
                              {aluno.apto ? "Apto" : "Inapto"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-muted-foreground text-xs">
                    Mínimo para certificado: {FREQUENCIA_MINIMA}% de frequência
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
