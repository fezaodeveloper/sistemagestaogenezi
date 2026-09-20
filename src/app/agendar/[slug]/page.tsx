import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgendamentoPaginaPublica, getContagemPorHorario } from "@/lib/agendamentos/agendamentos";
import { AgendamentoPublicoView } from "@/components/agendamentos/agendamento-publico-view";
import { AgendarTema } from "@/components/agendamentos/agendar-tema";
import { getPixelsParaPagina } from "@/lib/pixels/injetar";
import { PixelsScripts } from "@/components/pixels/pixels-scripts";
import { AGENDAMENTO_JANELA_DIAS } from "@/lib/agendamentos/schema";

const JANELA_DIAS = AGENDAMENTO_JANELA_DIAS;

// Página pública (sem login), acessível por qualquer visitante — sem
// requireRole. force-dynamic: a disponibilidade de horários (contagem de
// vagas ocupadas) muda a qualquer momento, não pode ser congelada como
// estática no build (mesmo motivo de /captacao).
export const dynamic = "force-dynamic";

export default async function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();
  const pagina = await getAgendamentoPaginaPublica(supabase, slug);
  if (!pagina) notFound();

  const hoje = new Date().toISOString().slice(0, 10);
  const foraDoPeriodo = (pagina.data_inicio && hoje < pagina.data_inicio) || (pagina.data_fim && hoje > pagina.data_fim);

  const admin = createAdminClient();
  const { data: config } = await admin
    .from("configuracoes")
    .select("escola_nome, escola_logo_url")
    .eq("id", true)
    .maybeSingle();

  const dataFimJanela = new Date();
  dataFimJanela.setDate(dataFimJanela.getDate() + JANELA_DIAS);
  const dataFimJanelaISO = pagina.data_fim && pagina.data_fim < dataFimJanela.toISOString().slice(0, 10)
    ? pagina.data_fim
    : dataFimJanela.toISOString().slice(0, 10);

  const contagemPorHorario = foraDoPeriodo ? {} : await getContagemPorHorario(pagina.id, hoje, dataFimJanelaISO);

  // Pixels de rastreamento (Apps > Pixels). O agendamento não tem curso: só recebe os sem restrição.
  const pixels = await getPixelsParaPagina();

  return (
    <AgendarTema>
      <PixelsScripts pixels={pixels} />
      <div className="flex w-full max-w-lg flex-col gap-6 py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {config?.escola_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
            <img
              src={config.escola_logo_url}
              alt={config?.escola_nome ?? "Gênezi"}
              className="h-12 object-contain dark:rounded-md dark:bg-white/95 dark:px-3 dark:py-1.5"
            />
          ) : (
            <p className="text-lg font-semibold">{config?.escola_nome ?? "Gênezi — Educação Profissional"}</p>
          )}
          <h1 className="text-2xl font-semibold">{pagina.titulo}</h1>
          {pagina.descricao && <p className="text-muted-foreground text-sm">{pagina.descricao}</p>}
        </div>

        {foraDoPeriodo ? (
          <p className="text-muted-foreground text-center text-sm">
            Esta página de agendamento não está disponível no momento.
          </p>
        ) : (
          <AgendamentoPublicoView pagina={pagina} contagemPorHorario={contagemPorHorario} />
        )}
      </div>
    </AgendarTema>
  );
}
