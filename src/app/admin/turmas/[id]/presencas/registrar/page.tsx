import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PRESENCA_STATUSES } from "@/lib/presencas/schema";
import type { Turma } from "@/lib/turmas/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChamadaForm } from "@/components/admin/chamada-form";

type AulaOpcao = { id: string; titulo: string };

type MatriculaAluno = {
  id: string;
  alunos: { email: string; profiles: { full_name: string | null } | null } | null;
};

export default async function RegistrarPresencaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aulaId?: string; data?: string }>;
}) {
  await requireRole("admin");
  const { id: turmaId } = await params;
  const { aulaId, data } = await searchParams;

  const supabase = await createClient();
  const [{ data: turmaData }, { data: aulasData }] = await Promise.all([
    supabase.from("turmas").select("*").eq("id", turmaId).single(),
    supabase.from("aulas").select("id, titulo, modulo_id, modulos(curso_id)").order("numero"),
  ]);
  const turma = turmaData as Turma | null;

  if (!turma) {
    notFound();
  }

  const aulasDoCurso = (
    (aulasData ?? []) as unknown as {
      id: string;
      titulo: string;
      modulos: { curso_id: string } | null;
    }[]
  )
    .filter((aula) => aula.modulos?.curso_id === turma.curso_id)
    .map((aula): AulaOpcao => ({ id: aula.id, titulo: aula.titulo }));

  // Passo 1: sem aula + data escolhidos ainda, mostra o seletor.
  if (!aulaId || !data) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Button
            render={<Link href={`/admin/turmas/${turmaId}/presencas`} />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
          >
            <ArrowLeft />
            Presenças
          </Button>
          <h1 className="text-2xl font-semibold">Nova chamada</h1>
          <p className="text-muted-foreground text-sm">{turma.nome}</p>
        </div>

        {aulasDoCurso.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-muted-foreground text-sm">
                Nenhuma aula cadastrada para o curso desta turma ainda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <form
            action={`/admin/turmas/${turmaId}/presencas/registrar`}
            className="flex max-w-xl flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="aulaId">Aula</Label>
              <Select
                name="aulaId"
                items={Object.fromEntries(aulasDoCurso.map((aula) => [aula.id, aula.titulo]))}
              >
                <SelectTrigger id="aulaId" className="w-64">
                  <SelectValue placeholder="Selecione a aula" />
                </SelectTrigger>
                <SelectContent>
                  {aulasDoCurso.map((aula) => (
                    <SelectItem key={aula.id} value={aula.id}>
                      {aula.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                name="data"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            <Button type="submit">Continuar</Button>
          </form>
        )}
      </div>
    );
  }

  // Passo 2: aula + data escolhidos — confere que a aula pertence ao curso
  // desta turma antes de montar a chamada.
  const aulaEscolhida = aulasDoCurso.find((aula) => aula.id === aulaId);
  if (!aulaEscolhida) {
    notFound();
  }

  const [{ data: matriculasData }, { data: presencasData }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("id, alunos(email, profiles!alunos_id_fkey(full_name))")
      .eq("turma_id", turmaId)
      .eq("status", "ativa"),
    supabase
      .from("presencas")
      .select("matricula_id, status, data_reposicao, justificativa")
      .eq("aula_id", aulaId)
      .eq("data", data),
  ]);

  const presencaPorMatricula = new Map(
    (
      (presencasData ?? []) as {
        matricula_id: string;
        status: (typeof PRESENCA_STATUSES)[number];
        data_reposicao: string | null;
        justificativa: string | null;
      }[]
    ).map((presenca) => [presenca.matricula_id, presenca]),
  );

  const alunos = ((matriculasData ?? []) as unknown as MatriculaAluno[])
    .map((matricula) => {
      const existente = presencaPorMatricula.get(matricula.id);
      return {
        matriculaId: matricula.id,
        nome: matricula.alunos?.profiles?.full_name || matricula.alunos?.email || "—",
        statusInicial: existente?.status ?? ("presente" as const),
        dataReposicaoInicial: existente?.data_reposicao ?? "",
        justificativaInicial: existente?.justificativa ?? "",
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/admin/turmas/${turmaId}/presencas`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Presenças
        </Button>
        <h1 className="text-2xl font-semibold">{aulaEscolhida.titulo}</h1>
        <p className="text-muted-foreground text-sm">
          {turma.nome} · {data.split("-").reverse().join("/")}
        </p>
      </div>

      {alunos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum aluno com matrícula ativa nesta turma.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <CardContent>
            <ChamadaForm turmaId={turmaId} aulaId={aulaId} data={data} alunos={alunos} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
