import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAgendamentoPagina, getAgendamentosPaginados, getResumoAgendamentos } from "@/lib/agendamentos/agendamentos";
import { calcularOffset, calcularTotalPaginas, LIMITE_PADRAO, parsePagina } from "@/lib/paginacao";
import { AgendamentosKanbanView } from "@/components/admin/agendamentos-kanban-view";

export default async function AgendamentoPaginaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string; page?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  // `page` (não "pagina"): é o nome que o componente Paginacao coloca na URL.
  const { data, page: paginaParam } = await searchParams;

  const supabase = await createClient();
  const pagina = await getAgendamentoPagina(supabase, id);
  if (!pagina) notFound();

  const paginaAtual = parsePagina(paginaParam);
  const [{ itens, total }, resumo] = await Promise.all([
    getAgendamentosPaginados(supabase, id, {
      data: data || undefined,
      offset: calcularOffset(paginaAtual, LIMITE_PADRAO),
      limite: LIMITE_PADRAO,
    }),
    getResumoAgendamentos(supabase, id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{pagina.titulo}</h1>
        <p className="text-muted-foreground text-sm">/agendar/{pagina.slug}</p>
      </div>

      <AgendamentosKanbanView
        paginaId={id}
        agendamentos={itens}
        camposExtrasConfigurados={pagina.campos_extras}
        resumo={resumo}
        dataFiltro={data ?? ""}
        totalRegistros={total}
        paginaAtual={paginaAtual}
        totalPaginas={calcularTotalPaginas(total, LIMITE_PADRAO)}
      />
    </div>
  );
}
