import { requireRole } from "@/lib/auth/dal";
import { getManutencaoChamados } from "@/app/admin/manutencao/actions";
import { ManutencaoView } from "@/components/admin/manutencao-view";
import { parseLimite, parsePagina } from "@/lib/paginacao";

export default async function ManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, q } = await searchParams;

  const pagina = parsePagina(page);
  const limite = parseLimite(limit);
  const query = q?.trim() ?? "";

  const { chamados, total } = await getManutencaoChamados({
    query: query || undefined,
    page: pagina,
    limit: limite,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Manutenção</h1>
        <p className="text-muted-foreground text-sm">Chamados internos de manutenção e infraestrutura.</p>
      </div>
      <ManutencaoView
        key={`${query}|${pagina}|${limite}`}
        chamadosIniciais={chamados}
        totalInicial={total}
        paginaInicial={pagina}
        limiteInicial={limite}
        queryInicial={query}
      />
    </div>
  );
}
