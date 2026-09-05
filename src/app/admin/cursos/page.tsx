import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CursosTable, type CursoListItem } from "@/components/admin/cursos-table";

const CURSOS_ORDER_BY_VALIDOS = ["nome", "recente", "aulas"] as const;
export type CursosOrderBy = (typeof CURSOS_ORDER_BY_VALIDOS)[number];

function parseCursosOrderBy(valor: string | undefined): CursosOrderBy {
  return (CURSOS_ORDER_BY_VALIDOS as readonly string[]).includes(valor ?? "")
    ? (valor as CursosOrderBy)
    : "nome";
}

// Duplicado do mesmo helper em cursos-table.tsx (Client Component) — evita
// importar uma function utilitária através da fronteira client/server, mesmo
// racional já usado em formatDataHora nesse arquivo.
function contarAulas(curso: CursoListItem): number {
  return curso.modulos.reduce((total, modulo) => total + (modulo.aulas?.length ?? 0), 0);
}

export default async function CursosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; orderBy?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, orderBy: orderByRaw } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);
  const orderBy = parseCursosOrderBy(orderByRaw);

  const supabase = await createClient();

  let cursos: CursoListItem[] | null = null;
  let error: unknown = null;
  let totalRegistros = 0;

  if (orderBy === "aulas") {
    // "Total de aulas" não é coluna nem agregação nativa do Postgres — sem
    // migration nesta rodada, busca todos os cursos, ordena e pagina em
    // memória (volume baixo: catálogo de cursos de uma escola).
    const resultado = await supabase.from("cursos").select("*, modulos(aulas(id))");
    error = resultado.error;
    if (!resultado.error) {
      const todos = ((resultado.data as CursoListItem[] | null) ?? []).sort(
        (a, b) => contarAulas(b) - contarAulas(a),
      );
      totalRegistros = todos.length;
      cursos = todos.slice(offset, offset + limite);
    }
  } else {
    let query = supabase.from("cursos").select("*, modulos(aulas(id))", { count: "exact" });
    query =
      orderBy === "recente"
        ? query.order("created_at", { ascending: false })
        : query.order("nome", { ascending: true });
    const resultado = await query.range(offset, offset + limite - 1);
    cursos = resultado.data as CursoListItem[] | null;
    error = resultado.error;
    totalRegistros = resultado.count ?? 0;
  }

  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cursos</h1>
        <p className="text-muted-foreground text-sm">Cadastro de cursos oferecidos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os cursos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !cursos || totalRegistros === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum curso cadastrado ainda.</p>
            <Button
              render={<Link href="/admin/cursos/novo" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Cadastrar primeiro curso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <CursosTable
            cursos={cursos}
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
