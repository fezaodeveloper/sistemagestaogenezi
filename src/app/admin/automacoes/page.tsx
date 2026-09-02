import { requireRole } from "@/lib/auth/dal";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { getEventosAutomacao } from "@/app/admin/automacoes/actions";
import { AutomacoesLogView } from "@/components/admin/automacoes-log-view";

export default async function AutomacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  await requireRole("admin");
  const { page, limit } = await searchParams;

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const { itens: eventos, total: totalRegistros } = await getEventosAutomacao({ offset, limite });
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Automações</h1>
        <p className="text-muted-foreground text-sm">
          Log dos eventos processados pelo motor de automações — {totalRegistros} no total.
        </p>
      </div>
      <AutomacoesLogView
        eventos={eventos}
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
      />
    </div>
  );
}
