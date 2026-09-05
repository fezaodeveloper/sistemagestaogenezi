import { requireRole } from "@/lib/auth/dal";
import { getEstoqueItens } from "@/app/admin/estoque/actions";
import { EstoqueView } from "@/components/admin/estoque-view";
import { parseLimite, parsePagina } from "@/lib/paginacao";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, q } = await searchParams;

  const pagina = parsePagina(page);
  const limite = parseLimite(limit);
  const query = q?.trim() ?? "";

  const { itens, total } = await getEstoqueItens({
    query: query || undefined,
    page: pagina,
    limit: limite,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Estoque</h1>
        <p className="text-muted-foreground text-sm">
          Controle de materiais, apostilas, fardas e kits.
        </p>
      </div>
      <EstoqueView
        key={`${query}|${pagina}|${limite}`}
        itensIniciais={itens}
        totalInicial={total}
        paginaInicial={pagina}
        limiteInicial={limite}
        queryInicial={query}
      />
    </div>
  );
}
