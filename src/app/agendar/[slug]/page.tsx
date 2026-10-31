import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgendamentoPaginaPublica, getContagemPorHorario, getHorariosOcupadosPorDia } from "@/lib/agendamentos/agendamentos";
import { AgendamentoPublicoView } from "@/components/agendamentos/agendamento-publico-view";
import { AgendarTema } from "@/components/agendamentos/agendar-tema";
import { getPixelsParaPagina } from "@/lib/pixels/injetar";
import { PixelsScripts } from "@/components/pixels/pixels-scripts";
import {
  AGENDAMENTO_JANELA_DIAS,
  resolverConfigVisual,
  TAMANHO_SUBTITULO_CSS,
  TAMANHO_TITULO_CSS,
} from "@/lib/agendamentos/schema";
import { FONTE_AGENDAMENTO_CSS } from "@/lib/agendamentos/fontes";

const JANELA_DIAS = AGENDAMENTO_JANELA_DIAS;

// Página pública (sem login), acessível por qualquer visitante — sem
// requireRole. force-dynamic: a disponibilidade de horários (contagem de
// vagas ocupadas) muda a qualquer momento, não pode ser congelada como
// estática no build (mesmo motivo de /captacao).
export const dynamic = "force-dynamic";

// TAREFA agendamentos 2.4/campanha 2.5 (PARTE 4) — favicon dinâmico (logo da escola) + Open
// Graph pra link bonito ao compartilhar no WhatsApp/Instagram.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const [pagina, { data: config }] = await Promise.all([
    getAgendamentoPaginaPublica(supabase, slug),
    createAdminClient().from("configuracoes").select("escola_nome, escola_logo_url").eq("id", true).maybeSingle(),
  ]);
  if (!pagina) return { title: "Página não encontrada" };

  const titulo = `${pagina.titulo} · ${config?.escola_nome ?? "Gênezi"}`;
  const descricao = pagina.descricao ?? "Agende seu horário.";

  return {
    title: titulo,
    description: descricao,
    icons: config?.escola_logo_url ? { icon: config.escola_logo_url } : undefined,
    openGraph: { title: titulo, description: descricao, images: config?.escola_logo_url ? [config.escola_logo_url] : undefined },
  };
}

export default async function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();
  const pagina = await getAgendamentoPaginaPublica(supabase, slug);
  if (!pagina) notFound();

  const hoje = new Date().toISOString().slice(0, 10);
  const foraDoPeriodo = (pagina.data_inicio && hoje < pagina.data_inicio) || (pagina.data_fim && hoje > pagina.data_fim);

  const admin = createAdminClient();
  const [{ data: config }, { data: responsavel }] = await Promise.all([
    admin.from("configuracoes").select("escola_nome, escola_logo_url, escola_telefone").eq("id", true).maybeSingle(),
    pagina.responsavel_id
      ? admin.from("profiles").select("full_name").eq("id", pagina.responsavel_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const dataFimJanela = new Date();
  dataFimJanela.setDate(dataFimJanela.getDate() + JANELA_DIAS);
  const dataFimJanelaISO = pagina.data_fim && pagina.data_fim < dataFimJanela.toISOString().slice(0, 10)
    ? pagina.data_fim
    : dataFimJanela.toISOString().slice(0, 10);

  const [contagemPorHorario, horariosOcupadosPorDia] = foraDoPeriodo
    ? [{}, {}]
    : await Promise.all([
        getContagemPorHorario(pagina.id, hoje, dataFimJanelaISO),
        getHorariosOcupadosPorDia(pagina.id, hoje, dataFimJanelaISO),
      ]);

  // Pixels de rastreamento (Apps > Pixels). O agendamento não tem curso: só recebe os sem restrição.
  const pixels = await getPixelsParaPagina();

  // TAREFA agendamentos — PARTE 4: aparência personalizada (resolverConfigVisual nunca quebra em
  // config_visual ausente/parcial/inválida — devolve sempre os 13 campos completos).
  const visual = resolverConfigVisual(pagina.config_visual);

  return (
    <AgendarTema>
      <PixelsScripts pixels={pixels} />
      <div
        className="flex w-full max-w-lg flex-col gap-6 rounded-lg p-6"
        style={{ backgroundColor: visual.cor_fundo, fontFamily: FONTE_AGENDAMENTO_CSS[visual.fonte] }}
      >
        <div className="flex flex-col items-center gap-2">
          {config?.escola_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
            <img
              src={config.escola_logo_url}
              alt={config?.escola_nome ?? "Gênezi"}
              className="h-12 self-center object-contain dark:rounded-md dark:bg-white/95 dark:px-3 dark:py-1.5"
            />
          ) : (
            <p className="self-center text-lg font-semibold" style={{ color: visual.cor_texto }}>
              {config?.escola_nome ?? "Gênezi — Educação Profissional"}
            </p>
          )}
          <h1
            className="w-full font-semibold"
            style={{ color: visual.cor_texto, fontSize: TAMANHO_TITULO_CSS[visual.titulo_tamanho], textAlign: visual.titulo_alinhamento }}
          >
            {pagina.titulo}
          </h1>
          {pagina.descricao && (
            <p
              className="w-full"
              style={{
                color: visual.cor_texto_secundario,
                fontSize: TAMANHO_SUBTITULO_CSS[visual.subtitulo_tamanho],
                textAlign: visual.subtitulo_alinhamento,
              }}
            >
              {pagina.descricao}
            </p>
          )}
          {pagina.local_atendimento && (
            <p className="w-full text-center text-sm" style={{ color: visual.cor_texto_secundario }}>
              📍 {pagina.local_atendimento}
            </p>
          )}
        </div>

        {foraDoPeriodo ? (
          <p className="text-muted-foreground text-center text-sm">
            Esta página de agendamento não está disponível no momento.
          </p>
        ) : (
          <AgendamentoPublicoView
            pagina={pagina}
            contagemPorHorario={contagemPorHorario}
            horariosOcupadosPorDia={horariosOcupadosPorDia}
            escolaTelefone={config?.escola_telefone ?? null}
            nomeResponsavel={(responsavel?.full_name as string | null) ?? null}
          />
        )}
      </div>
    </AgendarTema>
  );
}
