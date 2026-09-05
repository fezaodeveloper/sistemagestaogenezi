import { requireRole } from "@/lib/auth/dal";
import { getEstoqueEntregas } from "@/app/admin/estoque/actions";
import { EstoqueEntregasView } from "@/components/admin/estoque-entregas-view";
import { calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";

export default async function EstoqueEntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, q } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const query = q?.trim() ?? "";

  const { entregas, total } = await getEstoqueEntregas({
    query: query || undefined,
    page: paginaAtual,
    limit: limite,
  });

  const totalPaginas = calcularTotalPaginas(total, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Entregas para Alunos</h1>
        <p className="text-muted-foreground text-sm">Histórico de itens entregues aos alunos.</p>
      </div>
      <EstoqueEntregasView
        entregas={entregas}
        totalRegistros={total}
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        limite={limite}
        query={query}
      />
    </div>
  );
}
