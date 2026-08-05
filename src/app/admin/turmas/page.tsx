import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TURMA_STATUS_LABELS, type TurmaWithCurso } from "@/lib/turmas/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteTurmaButton } from "@/components/admin/delete-turma-button";

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

const STATUS_BADGE_VARIANT = {
  planejada: "secondary",
  ativa: "default",
  encerrada: "outline",
  cancelada: "destructive",
} as const;

export default async function TurmasPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("*, cursos(nome)")
    .order("created_at", { ascending: false });
  const turmas = data as TurmaWithCurso[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Turmas</h1>
          <p className="text-muted-foreground text-sm">Turmas vinculadas aos cursos.</p>
        </div>
        <Button render={<Link href="/admin/turmas/novo" />} nativeButton={false}>
          <Plus />
          Nova turma
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as turmas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !turmas || turmas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma turma cadastrada ainda.</p>
            <Button
              render={<Link href="/admin/turmas/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeira turma
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turma</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Vagas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turmas.map((turma) => (
                <TableRow key={turma.id}>
                  <TableCell className="font-medium">{turma.nome}</TableCell>
                  <TableCell>{turma.cursos?.nome ?? "—"}</TableCell>
                  <TableCell>{formatDateBR(turma.data_inicio)}</TableCell>
                  <TableCell>{formatDateBR(turma.data_fim)}</TableCell>
                  <TableCell>{turma.capacidade_maxima}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[turma.status]}>
                      {TURMA_STATUS_LABELS[turma.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      render={<Link href={`/admin/turmas/${turma.id}/presencas`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Presenças
                    </Button>
                    <Button
                      render={<Link href={`/admin/turmas/${turma.id}/editar`} />}
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <DeleteTurmaButton id={turma.id} nome={turma.nome} />
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
