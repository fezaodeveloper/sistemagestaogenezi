import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Agendamento, AgendamentoPagina, AgendamentoStatus } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export type AgendamentoPaginaComContagem = AgendamentoPagina & { totalAgendamentos: number };

export async function getAgendamentoPaginasAdmin(
  supabase: SupabaseServerClient,
): Promise<AgendamentoPaginaComContagem[]> {
  const { data } = await supabase
    .from("agendamento_paginas")
    .select("*")
    .order("created_at", { ascending: false });

  const paginas = (data as AgendamentoPagina[] | null) ?? [];

  const comContagem = await Promise.all(
    paginas.map(async (pagina) => {
      const { count } = await supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("pagina_id", pagina.id);
      return { ...pagina, totalAgendamentos: count ?? 0 };
    }),
  );

  return comContagem;
}

export async function getAgendamentoPagina(
  supabase: SupabaseServerClient,
  id: string,
): Promise<AgendamentoPagina | null> {
  const { data } = await supabase.from("agendamento_paginas").select("*").eq("id", id).maybeSingle();
  return data as AgendamentoPagina | null;
}

// Lida pelo Server Component público (/agendar/[slug]) — o client normal já
// funciona sem sessão porque a policy "Público pode ver páginas ativas"
// libera select por status, e há grant de select pra anon (ver migration).
export async function getAgendamentoPaginaPublica(
  supabase: SupabaseServerClient,
  slug: string,
): Promise<AgendamentoPagina | null> {
  const { data } = await supabase
    .from("agendamento_paginas")
    .select("*")
    .eq("slug", slug)
    .eq("status", "ativa")
    .maybeSingle();
  return data as AgendamentoPagina | null;
}

export async function getAgendamentos(
  supabase: SupabaseServerClient,
  paginaId: string,
  filtros?: { data?: string; status?: AgendamentoStatus },
): Promise<Agendamento[]> {
  let query = supabase
    .from("agendamentos")
    .select("*")
    .eq("pagina_id", paginaId)
    .order("data_agendada", { ascending: true })
    .order("horario", { ascending: true });

  if (filtros?.data) query = query.eq("data_agendada", filtros.data);
  if (filtros?.status) query = query.eq("status", filtros.status);

  const { data } = await query;
  return (data as Agendamento[] | null) ?? [];
}

// Listagem do Kanban (admin) — paginada. Exclui `cancelado`: o Kanban só tem
// as colunas Agendado/Faltou/Realizado, e contar cancelados no total da
// paginação deixaria a página com menos cards do que o limite. Mais recentes
// primeiro (data e horário decrescentes).
export async function getAgendamentosPaginados(
  supabase: SupabaseServerClient,
  paginaId: string,
  filtros: { data?: string; offset: number; limite: number },
): Promise<{ itens: Agendamento[]; total: number }> {
  let query = supabase
    .from("agendamentos")
    .select("*", { count: "exact" })
    .eq("pagina_id", paginaId)
    .neq("status", "cancelado")
    .order("data_agendada", { ascending: false })
    .order("horario", { ascending: false });

  if (filtros.data) query = query.eq("data_agendada", filtros.data);

  query = query.range(filtros.offset, filtros.offset + filtros.limite - 1);

  const { data, count } = await query;
  return { itens: (data as Agendamento[] | null) ?? [], total: count ?? 0 };
}

export type ResumoAgendamentos = Record<AgendamentoStatus, number> & { total: number };

// Contadores do histórico completo da página (ignora filtro de data e
// paginação) — só a coluna `status` é lida, então a query é leve mesmo com
// muitas linhas.
export async function getResumoAgendamentos(
  supabase: SupabaseServerClient,
  paginaId: string,
): Promise<ResumoAgendamentos> {
  const { data } = await supabase.from("agendamentos").select("status").eq("pagina_id", paginaId);

  const resumo: ResumoAgendamentos = { total: 0, confirmado: 0, cancelado: 0, realizado: 0, faltou: 0 };
  for (const linha of (data as { status: AgendamentoStatus }[] | null) ?? []) {
    resumo.total += 1;
    resumo[linha.status] += 1;
  }
  return resumo;
}

// Contagem de vagas ocupadas por dia/horário, só pra calcular disponibilidade
// na página pública — nunca expõe nome/whatsapp (só data_agendada/horario),
// e roda com o client admin (service_role) porque `anon` não tem select em
// `agendamentos` (ver comentário de segurança na migration). Considera só
// status 'confirmado': cancelado/faltou libera a vaga de novo.
export async function getContagemPorHorario(
  paginaId: string,
  dataInicioISO: string,
  dataFimISO: string,
): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agendamentos")
    .select("data_agendada, horario")
    .eq("pagina_id", paginaId)
    .eq("status", "confirmado")
    .gte("data_agendada", dataInicioISO)
    .lte("data_agendada", dataFimISO);

  const contagem: Record<string, number> = {};
  for (const linha of (data as { data_agendada: string; horario: string }[] | null) ?? []) {
    const chave = `${linha.data_agendada}_${linha.horario}`;
    contagem[chave] = (contagem[chave] ?? 0) + 1;
  }
  return contagem;
}

// Valida no servidor (defesa em profundidade — o client já filtra isso na
// UI, mas nunca confia só nisso) que a data/horário escolhidos batem com
// horarios_disponiveis, o período da página e a antecedência mínima.
export function validarSlotPermitido(pagina: AgendamentoPagina, dataISO: string, horario: string): boolean {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataMinima = new Date();
  dataMinima.setDate(dataMinima.getDate() + pagina.dias_antecedencia_minimo);
  const dataMinimaISO = dataMinima.toISOString().slice(0, 10);

  if (dataISO < dataMinimaISO) return false;
  if (pagina.data_inicio && dataISO < pagina.data_inicio) return false;
  if (pagina.data_fim && dataISO > pagina.data_fim) return false;
  if (dataISO < hoje) return false;

  const diaSemana = new Date(`${dataISO}T00:00:00`).getDay();
  return pagina.horarios_disponiveis.some((h) => h.dia_semana === diaSemana && h.horario === horario);
}

// Recontagem no exato momento do insert (corrida entre "carregou a página" e
// "confirmou o agendamento") — chamado pela Server Action pública antes de
// gravar, com o client admin pelo mesmo motivo de getContagemPorHorario.
export async function contarVagasOcupadasNoSlot(
  admin: SupabaseAdminClient,
  paginaId: string,
  dataISO: string,
  horario: string,
): Promise<number> {
  const { count } = await admin
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("pagina_id", paginaId)
    .eq("data_agendada", dataISO)
    .eq("horario", horario)
    .eq("status", "confirmado");
  return count ?? 0;
}
