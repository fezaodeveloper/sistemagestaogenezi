import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PRESENCA_STATUSES } from "@/lib/presencas/schema";
import type { Turma } from "@/lib/turmas/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PresencaStatus = (typeof PRESENCA_STATUSES)[number];

type PresencaRow = {
  aula_id: string;
  data: string;
  status: PresencaStatus;
  aulas: { titulo: string } | null;
};

type Sessao = {
  aulaId: string;
  aulaTitulo: string;
  data: string;
  counts: Record<PresencaStatus, number>;
  total: number;
};

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function agruparSessoes(rows: PresencaRow[]): Sessao[] {
  const map = new Map<string, Sessao>();
  for (const row of rows) {
    const key = `${row.aula_id}|${row.data}`;
    let sessao = map.get(key);
    if (!sessao) {
      sessao = {
        aulaId: row.aula_id,
        aulaTitulo: row.aulas?.titulo ?? "—",
        data: row.data,
        counts: { presente: 0, falta: 0, justificada: 0, reposicao: 0 },
        total: 0,
      };
      map.set(key, sessao);
    }
    sessao.counts[row.status] += 1;
    sessao.total += 1;
  }
  return Array.from(map.values()).sort((a, b) => (a.data < b.data ? 1 : -1));
}

export default async function PresencasPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id: turmaId } = await params;

  const supabase = await createClient();
  const [{ data: turmaData }, { data, error }] = await Promise.all([
    supabase.from("turmas").select("*").eq("id", turmaId).single(),
    supabase
      .from("presencas")
      .select("aula_id, data, status, aulas(titulo), matriculas!inner(turma_id)")
      .eq("matriculas.turma_id", turmaId),
  ]);
  const turma = turmaData as Turma | null;

  if (!turma) {
    notFound();
  }

  const sessoes = data ? agruparSessoes(data as unknown as PresencaRow[]) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href="/admin/turmas" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Turmas
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Presenças</h1>
            <p className="text-muted-foreground text-sm">{turma.nome}</p>
          </div>
          <Button
            render={<Link href={`/admin/turmas/${turmaId}/presencas/registrar`} />}
            nativeButton={false}
          >
            <Plus />
            Nova chamada
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as presenças. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !sessoes || sessoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma chamada registrada ainda.</p>
            <Button
              render={<Link href={`/admin/turmas/${turmaId}/presencas/registrar`} />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Fazer a primeira chamada
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aula</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Presentes</TableHead>
                <TableHead>Faltas</TableHead>
                <TableHead>Justificadas</TableHead>
                <TableHead>Reposições</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessoes.map((sessao) => (
                <TableRow key={`${sessao.aulaId}|${sessao.data}`}>
                  <TableCell className="font-medium">{sessao.aulaTitulo}</TableCell>
                  <TableCell>{formatDateBR(sessao.data)}</TableCell>
                  <TableCell>{sessao.counts.presente}</TableCell>
                  <TableCell>{sessao.counts.falta}</TableCell>
                  <TableCell>{sessao.counts.justificada}</TableCell>
                  <TableCell>{sessao.counts.reposicao}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      render={
                        <Link
                          href={`/admin/turmas/${turmaId}/presencas/registrar?aulaId=${sessao.aulaId}&data=${sessao.data}`}
                        />
                      }
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Ver / editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
