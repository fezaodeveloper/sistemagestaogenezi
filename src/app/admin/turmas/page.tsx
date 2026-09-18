import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { parseBusca, termoIlike } from "@/lib/busca";
import type { TurmaWithCurso } from "@/lib/turmas/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TurmasTable } from "@/components/admin/turmas-table";

const TURMAS_ORDER_BY_VALIDOS = ["nome", "recente", "inicio"] as const;
export type TurmasOrderBy = (typeof TURMAS_ORDER_BY_VALIDOS)[number];

function parseTurmasOrderBy(valor: string | undefined): TurmasOrderBy {
  return (TURMAS_ORDER_BY_VALIDOS as readonly string[]).includes(valor ?? "")
    ? (valor as TurmasOrderBy)
    : "nome";
}

export default async function TurmasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; orderBy?: string; q?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, orderBy: orderByRaw, q: qRaw } = await searchParams;
  const q = parseBusca(qRaw);

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);
  const orderBy = parseTurmasOrderBy(orderByRaw);

  const supabase = await createClient();
  let query = supabase.from("turmas").select("*, cursos(nome)", { count: "exact" });
  if (q) {
    // Nome da turma OU nome do curso. O curso vem por embed, e um filtro `or`
    // não alcança colunas de tabela embutida — então primeiro acha os cursos
    // cujo nome bate e filtra as turmas por curso_id.
    const termo = termoIlike(q);
    const { data: cursosEncontrados } = await supabase
      .from("cursos")
      .select("id")
      .ilike("nome", `%${termo}%`)
      .limit(100);
    const idsCursos = (cursosEncontrados ?? []).map((curso) => curso.id as string);
    const condicoes = [`nome.ilike.%${termo}%`];
    if (idsCursos.length > 0) condicoes.push(`curso_id.in.(${idsCursos.join(",")})`);
    query = query.or(condicoes.join(","));
  }
  if (orderBy === "recente") {
    query = query.order("created_at", { ascending: false });
  } else if (orderBy === "inicio") {
    query = query.order("data_inicio", { ascending: true });
  } else {
    query = query.order("nome", { ascending: true });
  }

  const { data, error, count } = await query.range(offset, offset + limite - 1);
  const turmas = data as TurmaWithCurso[] | null;
  const totalRegistros = count ?? 0;
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Turmas</h1>
        <p className="text-muted-foreground text-sm">Turmas vinculadas aos cursos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as turmas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !turmas || (totalRegistros === 0 && !q) ? (
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
        <Card className="p-4">
          <TurmasTable
            turmas={turmas}
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            limite={limite}
            orderBy={orderBy}
            q={q}
          />
        </Card>
      )}
    </div>
  );
}
