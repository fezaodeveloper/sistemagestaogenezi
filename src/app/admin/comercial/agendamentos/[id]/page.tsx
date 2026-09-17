import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAgendamentoPagina, getAgendamentos } from "@/lib/agendamentos/agendamentos";
import { AGENDAMENTO_STATUSES, type AgendamentoStatus } from "@/lib/agendamentos/schema";
import { AgendamentosListaView } from "@/components/admin/agendamentos-lista-view";

export default async function AgendamentoPaginaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ data?: string; status?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { data, status } = await searchParams;

  const supabase = await createClient();
  const pagina = await getAgendamentoPagina(supabase, id);
  if (!pagina) notFound();

  const statusFiltro = AGENDAMENTO_STATUSES.includes(status as AgendamentoStatus)
    ? (status as AgendamentoStatus)
    : undefined;

  const agendamentos = await getAgendamentos(supabase, id, { data: data || undefined, status: statusFiltro });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{pagina.titulo}</h1>
        <p className="text-muted-foreground text-sm">/agendar/{pagina.slug}</p>
      </div>

      <AgendamentosListaView
        paginaId={id}
        agendamentos={agendamentos}
        camposExtrasConfigurados={pagina.campos_extras}
        dataFiltro={data ?? ""}
        statusFiltro={statusFiltro ?? ""}
      />
    </div>
  );
}
