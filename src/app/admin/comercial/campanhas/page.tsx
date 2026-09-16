import { requireRole } from "@/lib/auth/dal";
import { calcularTotalPaginas, parsePagina } from "@/lib/paginacao";
import { CAMPANHA_STATUSES, type CampanhaStatus } from "@/lib/campanhas/schema";
import { getCampanhas } from "@/app/admin/comercial/campanhas/actions";
import { CampanhasMarketingView } from "@/components/admin/campanhas-marketing-view";

const LIMITE_CAMPANHAS = 12;

function parseStatus(valor: string | undefined): CampanhaStatus | undefined {
  return (CAMPANHA_STATUSES as readonly string[]).includes(valor ?? "")
    ? (valor as CampanhaStatus)
    : undefined;
}

export default async function CampanhasMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireRole("admin");

  const { q, status: statusRaw, page } = await searchParams;
  const query = q ?? "";
  const status = parseStatus(statusRaw);
  const paginaAtual = parsePagina(page);

  const { campanhas, total } = await getCampanhas({
    query,
    status,
    page: paginaAtual,
    limit: LIMITE_CAMPANHAS,
  });

  const totalPaginas = calcularTotalPaginas(total, LIMITE_CAMPANHAS);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Campanhas de Marketing</h1>
        <p className="text-muted-foreground text-sm">
          Planejamento e acompanhamento das campanhas de divulgação da escola.
        </p>
      </div>

      <CampanhasMarketingView
        campanhas={campanhas}
        totalRegistros={total}
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        limite={LIMITE_CAMPANHAS}
        query={query}
        status={status ?? ""}
      />
    </div>
  );
}
