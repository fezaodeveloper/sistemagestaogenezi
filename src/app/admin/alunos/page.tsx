import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlunosTable, type AlunoListItem } from "@/components/admin/alunos-table";

const ALUNOS_ORDER_BY_VALIDOS = ["nome", "recente", "risco"] as const;
export type AlunosOrderBy = (typeof ALUNOS_ORDER_BY_VALIDOS)[number];

function parseAlunosOrderBy(valor: string | undefined): AlunosOrderBy {
  return (ALUNOS_ORDER_BY_VALIDOS as readonly string[]).includes(valor ?? "")
    ? (valor as AlunosOrderBy)
    : "nome";
}

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ criado?: string; page?: string; limit?: string; orderBy?: string }>;
}) {
  await requireRole("admin");
  const { criado, page, limit, orderBy: orderByRaw } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);
  const orderBy = parseAlunosOrderBy(orderByRaw);

  const supabase = await createClient();

  // Ordenar por nome exige embutir profiles com !inner (só assim
  // referencedTable afeta a ordem das linhas de "alunos", não só a ordem
  // dentro de cada embed — ver docs do postgrest-js) — seguro aqui porque
  // todo aluno tem profile (mesmo id, FK obrigatória).
  const selectClause =
    orderBy === "nome"
      ? "*, profiles!alunos_id_fkey!inner(full_name), matriculas(status, turmas(nome))"
      : "*, profiles!alunos_id_fkey(full_name), matriculas(status, turmas(nome))";

  let alunosQuery = supabase.from("alunos").select(selectClause, { count: "exact" });
  if (orderBy === "nome") {
    alunosQuery = alunosQuery.order("full_name", { referencedTable: "profiles", ascending: true });
  } else if (orderBy === "recente") {
    alunosQuery = alunosQuery.order("created_at", { ascending: false });
  }
  // "risco" não tem coluna/agregação nativa pra ordenar no banco (o índice
  // é o MAIOR valor entre as linhas de indices_evasao do aluno, calculado
  // em memória logo abaixo) — busca a lista inteira nesse caso, sem
  // .range(), pra ordenar e paginar depois em JS.
  if (orderBy !== "risco") {
    alunosQuery = alunosQuery.range(offset, offset + limite - 1);
  }

  const [{ data, error, count }, { data: indicesData }] = await Promise.all([
    alunosQuery,
    supabase.from("indices_evasao").select("aluno_id, indice"),
  ]);

  // Um aluno pode ter mais de uma matrícula (logo mais de uma linha em
  // indices_evasao) — a tabela mostra o pior caso (maior índice) entre
  // elas, é o que mais importa pro admin decidir se precisa agir.
  const indicePorAluno = new Map<string, number>();
  for (const linha of (indicesData ?? []) as { aluno_id: string; indice: number }[]) {
    const atual = indicePorAluno.get(linha.aluno_id) ?? -1;
    if (linha.indice > atual) indicePorAluno.set(linha.aluno_id, linha.indice);
  }

  let totalRegistros = count ?? 0;
  let alunos = (data as AlunoListItem[] | null)?.map((aluno) => ({
    ...aluno,
    indiceEvasao: indicePorAluno.get(aluno.id) ?? null,
  }));

  if (orderBy === "risco" && alunos) {
    alunos = [...alunos].sort((a, b) => (b.indiceEvasao ?? -1) - (a.indiceEvasao ?? -1));
    totalRegistros = alunos.length;
    alunos = alunos.slice(offset, offset + limite);
  }

  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

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
            orderBy={orderBy}
          />
        </Card>
      )}
    </div>
  );
}
