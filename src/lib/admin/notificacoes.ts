import type { createClient } from "@/lib/supabase/server";
import type { ConfiguracoesNotificacoes } from "@/lib/configuracoes/schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NotificacaoSinoGrupo = {
  tipo: "financeiro" | "certificados" | "eventos_hoje" | "eventos_amanha";
  titulo: string;
  quantidade: number;
  href: string;
  itens?: string[];
};

// Sino do header do admin (src/app/admin/layout.tsx) — cada grupo só entra
// no resultado se a preferência correspondente estiver ligada E houver algo
// pendente daquele tipo (sino "limpo" não aparece com badge 0).
export async function getContadoresNotificacoes(
  supabase: SupabaseServerClient,
  config: ConfiguracoesNotificacoes,
): Promise<NotificacaoSinoGrupo[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataAmanha = new Date();
  dataAmanha.setDate(dataAmanha.getDate() + 1);
  const amanha = dataAmanha.toISOString().slice(0, 10);

  const [{ count: parcelasAtrasadas }, { count: certificadosPendentes }, { data: eventosData }] =
    await Promise.all([
      supabase.from("parcelas").select("id", { count: "exact", head: true }).eq("status", "atrasado"),
      supabase.from("certificados").select("id", { count: "exact", head: true }).eq("liberado", false),
      // Qualquer evento cujo intervalo [data_inicio, data_fim] toca o dia de
      // hoje ou de amanhã — data_fim sempre vem preenchida (createEvento usa
      // data_inicio como fallback), então essa faixa cobre os dois casos.
      supabase
        .from("eventos_calendario")
        .select("id, nome, data_inicio, data_fim")
        .lte("data_inicio", amanha)
        .gte("data_fim", hoje),
    ]);

  const eventos = (eventosData ?? []) as { id: string; nome: string; data_inicio: string; data_fim: string }[];
  const eventosHoje = eventos.filter((evento) => evento.data_inicio <= hoje && hoje <= evento.data_fim);
  const eventosAmanha = eventos.filter((evento) => evento.data_inicio <= amanha && amanha <= evento.data_fim);

  const grupos: NotificacaoSinoGrupo[] = [];

  if (config.notif_financeiro_atrasado && (parcelasAtrasadas ?? 0) > 0) {
    grupos.push({
      tipo: "financeiro",
      titulo: "Pagamentos em atraso",
      quantidade: parcelasAtrasadas ?? 0,
      href: "/admin/financeiro",
    });
  }

  if (config.notif_certificados_pendentes && (certificadosPendentes ?? 0) > 0) {
    grupos.push({
      tipo: "certificados",
      titulo: "Certificados aguardando liberação",
      quantidade: certificadosPendentes ?? 0,
      href: "/admin/certificados",
    });
  }

  if (config.notif_eventos_hoje && eventosHoje.length > 0) {
    grupos.push({
      tipo: "eventos_hoje",
      titulo: "Eventos hoje",
      quantidade: eventosHoje.length,
      href: "/admin/calendario",
      itens: eventosHoje.map((evento) => evento.nome),
    });
  }

  if (config.notif_eventos_amanha && eventosAmanha.length > 0) {
    grupos.push({
      tipo: "eventos_amanha",
      titulo: "Eventos amanhã",
      quantidade: eventosAmanha.length,
      href: "/admin/calendario",
      itens: eventosAmanha.map((evento) => evento.nome),
    });
  }

  return grupos;
}
