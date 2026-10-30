import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Agendamento, AgendamentoPagina, AgendamentoStatus } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export type AgendamentoPaginaComContagem = AgendamentoPagina & { totalAgendamentos: number };

// Autoatendimento público (TAREFA agendamentos 2.4, PARTE 4): o UUID do agendamento funciona
// como "token" de acesso (sem login) — quem tem o link pode ver/cancelar/remarcar ESTE
// agendamento, nunca uma lista. Por isso usa sempre o client admin (service_role): não existe
// policy de select pública em `agendamentos` (ver comentário de segurança na migration
// original), de propósito.
export async function getAgendamentoComPaginaPublico(
  agendamentoId: string,
  slug: string,
): Promise<{ agendamento: Agendamento; pagina: AgendamentoPagina } | null> {
  const admin = createAdminClient();
  const { data: agendamento } = await admin.from("agendamentos").select("*").eq("id", agendamentoId).maybeSingle();
  if (!agendamento) return null;

  const { data: pagina } = await admin
    .from("agendamento_paginas")
    .select("*")
    .eq("id", (agendamento as Agendamento).pagina_id)
    .eq("slug", slug)
    .maybeSingle();
  if (!pagina) return null;

  return { agendamento: agendamento as Agendamento, pagina: pagina as AgendamentoPagina };
}

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

// Aba "Cancelados" do Kanban — só visualização (sem paginação de verdade, por isso o limit fixo
// em vez do mesmo range() de getAgendamentosPaginados). Mais recentes primeiro por created_at
// (quando o cancelamento aconteceu), não por data_agendada (a aula/visita que não vai mais
// acontecer) — é o que importa pra essa lista.
export async function getAgendamentosCancelados(
  supabase: SupabaseServerClient,
  paginaId: string,
): Promise<Agendamento[]> {
  const { data } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("pagina_id", paginaId)
    .eq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as Agendamento[] | null) ?? [];
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
// horarios_disponiveis, o período da página, a antecedência mínima/máxima e
// as datas bloqueadas (feriados ou específicas). NÃO checa intervalo entre
// horários nem vagas — isso depende de QUAIS outros agendamentos já existem
// no slot, então fica em horarioBloqueadoPorIntervalo/contarVagasOcupadasNoSlot
// (a primeira já é usada por quem chama esta função antes do insert).
export function validarSlotPermitido(pagina: AgendamentoPagina, dataISO: string, horario: string): boolean {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataMinima = new Date();
  dataMinima.setDate(dataMinima.getDate() + pagina.dias_antecedencia_minimo);
  const dataMinimaISO = dataMinima.toISOString().slice(0, 10);

  // ?? 30: coluna nova (migration 20261030500000) — se ainda não foi aplicada, select("*") não
  // traz a chave e cai no mesmo padrão default da coluna no banco.
  const antecedenciaMaxima = pagina.antecedencia_maxima_dias ?? 30;
  const dataMaxima = new Date();
  dataMaxima.setDate(dataMaxima.getDate() + antecedenciaMaxima);
  const dataMaximaISO = dataMaxima.toISOString().slice(0, 10);

  if (dataISO < dataMinimaISO) return false;
  if (dataISO > dataMaximaISO) return false;
  if (pagina.data_inicio && dataISO < pagina.data_inicio) return false;
  if (pagina.data_fim && dataISO > pagina.data_fim) return false;
  if (dataISO < hoje) return false;
  if ((pagina.datas_bloqueadas ?? []).includes(dataISO)) return false;
  if ((pagina.feriados_bloqueados ?? []).includes(dataISO)) return false;

  const diaSemana = new Date(`${dataISO}T00:00:00`).getDay();
  return pagina.horarios_disponiveis.some((h) => h.dia_semana === diaSemana && h.horario === horario);
}

// Horários distintos com agendamento confirmado, por dia, numa janela — base pro
// bloqueio por intervalo (tanto no calendário público quanto na validação do insert).
// Mesmo critério de segurança de getContagemPorHorario: só data_agendada/horario, nunca
// nome/whatsapp, e sempre via client admin.
export async function getHorariosOcupadosPorDia(
  paginaId: string,
  dataInicioISO: string,
  dataFimISO: string,
): Promise<Record<string, string[]>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agendamentos")
    .select("data_agendada, horario")
    .eq("pagina_id", paginaId)
    .eq("status", "confirmado")
    .gte("data_agendada", dataInicioISO)
    .lte("data_agendada", dataFimISO);

  const porDia: Record<string, string[]> = {};
  for (const linha of (data as { data_agendada: string; horario: string }[] | null) ?? []) {
    const lista = porDia[linha.data_agendada] ?? (porDia[linha.data_agendada] = []);
    if (!lista.includes(linha.horario)) lista.push(linha.horario);
  }
  return porDia;
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
