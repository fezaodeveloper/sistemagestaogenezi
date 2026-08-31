import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlunosTable, type AlunoListItem } from "@/components/admin/alunos-table";

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ criado?: string; page?: string; limit?: string }>;
}) {
  await requireRole("admin");
  const { criado, page, limit } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const supabase = await createClient();
  const [{ data, error, count }, { data: indicesData }] = await Promise.all([
    supabase
      .from("alunos")
      .select("*, profiles!alunos_id_fkey(full_name), matriculas(status, turmas(nome))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limite - 1),
    supabase.from("indices_evasao").select("aluno_id, indice"),
  ]);

  const totalRegistros = count ?? 0;
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  // Um aluno pode ter mais de uma matrícula (logo mais de uma linha em
  // indices_evasao) — a tabela mostra o pior caso (maior índice) entre
  // elas, é o que mais importa pro admin decidir se precisa agir.
  const indicePorAluno = new Map<string, number>();
  for (const linha of (indicesData ?? []) as { aluno_id: string; indice: number }[]) {
    const atual = indicePorAluno.get(linha.aluno_id) ?? -1;
    if (linha.indice > atual) indicePorAluno.set(linha.aluno_id, linha.indice);
  }

  const alunos = (data as AlunoListItem[] | null)?.map((aluno) => ({
    ...aluno,
    indiceEvasao: indicePorAluno.get(aluno.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-muted-foreground text-sm">Cadastro de alunos.</p>
        </div>
        <Button render={<Link href="/admin/alunos/novo" />} nativeButton={false}>
          <Plus />
          Novo aluno
        </Button>
      </div>

      {criado === "1" && (
        <p className="text-muted-foreground text-sm">Aluno cadastrado com sucesso.</p>
      )}

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os alunos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !alunos || totalRegistros === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum aluno cadastrado ainda.</p>
            <Button
              render={<Link href="/admin/alunos/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro aluno
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <AlunosTable
            alunos={alunos}
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            limite={limite}
          />
        </Card>
      )}
    </div>
  );
}
