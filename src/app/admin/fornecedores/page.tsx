import { requireRole } from "@/lib/auth/dal";
import { getFornecedores, type FornecedorOrderBy } from "@/app/admin/fornecedores/actions";
import { FornecedoresView } from "@/components/admin/fornecedores-view";
import { calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { FORNECEDOR_CATEGORIAS, type FornecedorCategoria } from "@/lib/fornecedores/schema";

const FORNECEDOR_ORDER_BY_VALIDOS = ["nome", "empresa", "recente"] as const;

function parseFornecedorOrderBy(valor: string | undefined): FornecedorOrderBy {
  return (FORNECEDOR_ORDER_BY_VALIDOS as readonly string[]).includes(valor ?? "")
    ? (valor as FornecedorOrderBy)
    : "nome";
}

function parseFornecedorCategoria(valor: string | undefined): FornecedorCategoria | undefined {
  return (FORNECEDOR_CATEGORIAS as readonly string[]).includes(valor ?? "")
    ? (valor as FornecedorCategoria)
    : undefined;
}

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    categoria?: string;
    orderBy?: string;
  }>;
}) {
  await requireRole("admin");
  const { page, limit, q, categoria: categoriaRaw, orderBy: orderByRaw } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const query = q?.trim() ?? "";
  const categoria = parseFornecedorCategoria(categoriaRaw);
  const orderBy = parseFornecedorOrderBy(orderByRaw);

  const { fornecedores, total } = await getFornecedores({
    query: query || undefined,
    categoria,
    orderBy,
    page: paginaAtual,
    limit: limite,
  });

  const totalPaginas = calcularTotalPaginas(total, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Fornecedores</h1>
        <p className="text-muted-foreground text-sm">
          Contatos de fornecedores e prestadores de serviço.
        </p>
      </div>
      <FornecedoresView
        fornecedores={fornecedores}
        totalRegistros={total}
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        limite={limite}
        query={query}
        categoria={categoria ?? "todas"}
        orderBy={orderBy}
      />
    </div>
  );
}
