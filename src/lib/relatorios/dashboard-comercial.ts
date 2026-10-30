import "server-only";

// Dashboard comercial (TAREFA dashboard 2.6) — todas as queries do novo
// src/app/admin/comercial/dashboard/page.tsx. Usa createAdminClient (service_role) de propósito,
// como pedido na tarefa: é uma tela só de leitura/agregação, sem RLS por linha a respeitar, e
// evita múltiplas idas ao client autenticado pra cada contagem.

import { createAdminClient } from "@/lib/supabase/admin";
import { KANBAN_COLUNAS_PADRAO, type KanbanColunaConfig } from "@/lib/leads/schema";

type Supabase = ReturnType<typeof createAdminClient>;

function isoDiasAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null; // null = "sem base de comparação" (nunca houve nada no período anterior)
  return Math.round(((atual - anterior) / anterior) * 100);
}

// ===== PARTE 2 — Cards de métricas =====

export type MetricasComerciais = {
  novosLeads: { valor: number; variacao: number | null };
  agendamentosRealizados: { valor: number; variacao: number | null };
  taxaConversao: number;
  matriculasMes: { valor: number; variacao: number | null };
};

export async function getMetricasComerciais(admin: Supabase): Promise<MetricasComerciais> {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
  const fimMesAnterior = inicioMes;

  const [
    { count: leads30 },
    { count: leads60a30 },
    { count: agendRealizados30 },
    { count: agendRealizados60a30 },
    { count: totalLeads },
    { count: leadsMatriculados },
    { count: matriculasMesAtual },
    { count: matriculasMesAnterior },
  ] = await Promise.all([
    admin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", isoDiasAtras(30)),
    admin.from("leads").select("id", { count: "exact", head: true }).gte("created_at", isoDiasAtras(60)).lt("created_at", isoDiasAtras(30)),
    admin.from("agendamentos").select("id", { count: "exact", head: true }).eq("status", "realizado").gte("data_agendada", isoDiasAtras(30).slice(0, 10)),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("status", "realizado")
      .gte("data_agendada", isoDiasAtras(60).slice(0, 10))
      .lt("data_agendada", isoDiasAtras(30).slice(0, 10)),
    admin.from("leads").select("id", { count: "exact", head: true }),
    // "status 'matriculado'" não existe nos status de lead (novo/contatado/aluno_ativo/ex_aluno/
    // desistente/descartado) — o equivalente real é a coluna do Kanban (protegida, id fixo
    // "matriculado", ver KANBAN_COLUNAS_PROTEGIDAS em lib/leads/schema.ts).
    admin.from("leads").select("id", { count: "exact", head: true }).eq("kanban_coluna", "matriculado"),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("kanban_coluna", "matriculado").gte("updated_at", inicioMes),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("kanban_coluna", "matriculado")
      .gte("updated_at", inicioMesAnterior)
      .lt("updated_at", fimMesAnterior),
  ]);

  return {
    novosLeads: { valor: leads30 ?? 0, variacao: variacaoPercentual(leads30 ?? 0, leads60a30 ?? 0) },
    agendamentosRealizados: {
      valor: agendRealizados30 ?? 0,
      variacao: variacaoPercentual(agendRealizados30 ?? 0, agendRealizados60a30 ?? 0),
    },
    taxaConversao: totalLeads ? Math.round(((leadsMatriculados ?? 0) / totalLeads) * 1000) / 10 : 0,
    matriculasMes: {
      valor: matriculasMesAtual ?? 0,
      variacao: variacaoPercentual(matriculasMesAtual ?? 0, matriculasMesAnterior ?? 0),
    },
  };
}

// ===== PARTE 3 — Funil de conversão =====

export type FunilEtapa = { id: string; nome: string; cor: string; total: number; percentual: number };

// "Contar leads nela hoje" (texto da tarefa) interpretado como "quantos leads estão HOJE, agora,
// nessa coluna" — uma foto do pipeline atual — e não "leads criados hoje" (isso daria quase zero
// em toda coluna que não seja "Novo", o funil pedido no exemplo claramente soma o pipeline
// inteiro, não um dia só).
export async function getFunilConversao(admin: Supabase): Promise<FunilEtapa[]> {
  const { data: colunasData } = await admin.from("kanban_colunas").select("id, nome, ordem, cor").order("ordem", { ascending: true });
  const colunas: KanbanColunaConfig[] = colunasData?.length ? (colunasData as KanbanColunaConfig[]) : KANBAN_COLUNAS_PADRAO;

  const { data: leadsData } = await admin.from("leads").select("kanban_coluna");
  const contagem = new Map<string, number>();
  for (const linha of (leadsData ?? []) as { kanban_coluna: string }[]) {
    contagem.set(linha.kanban_coluna, (contagem.get(linha.kanban_coluna) ?? 0) + 1);
  }
  const total = (leadsData ?? []).length;

  return colunas.map((coluna) => {
    const totalColuna = contagem.get(coluna.id) ?? 0;
    return { id: coluna.id, nome: coluna.nome, cor: coluna.cor, total: totalColuna, percentual: total > 0 ? Math.round((totalColuna / total) * 100) : 0 };
  });
}

// ===== PARTE 4 — Leads por período =====

export type LeadsPorDiaPonto = { data: string; total: number };

async function leadsPorDiaEmJanela(admin: Supabase, dias: number): Promise<LeadsPorDiaPonto[]> {
  const desde = isoDiasAtras(dias);
  const { data } = await admin.from("leads").select("created_at").gte("created_at", desde);

  const porDia = new Map<string, number>();
  for (const linha of (data ?? []) as { created_at: string }[]) {
    const dia = linha.created_at.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  const pontos: LeadsPorDiaPonto[] = [];
  const cursor = new Date(desde);
  cursor.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  while (cursor <= hoje) {
    const diaISO = cursor.toISOString().slice(0, 10);
    pontos.push({ data: diaISO, total: porDia.get(diaISO) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return pontos;
}

export type LeadsPorPeriodo = { dias30: LeadsPorDiaPonto[]; dias90: LeadsPorDiaPonto[]; anoAtual: LeadsPorDiaPonto[] };

export async function getLeadsPorPeriodo(admin: Supabase): Promise<LeadsPorPeriodo> {
  const inicioAno = new Date(new Date().getFullYear(), 0, 1);
  const diasDesdeInicioAno = Math.ceil((Date.now() - inicioAno.getTime()) / 86_400_000);

  const [dias30, dias90, anoAtual] = await Promise.all([
    leadsPorDiaEmJanela(admin, 30),
    leadsPorDiaEmJanela(admin, 90),
    leadsPorDiaEmJanela(admin, diasDesdeInicioAno),
  ]);
  return { dias30, dias90, anoAtual };
}

// ===== PARTE 5 — Agendamentos de hoje =====

export type AgendamentoHoje = { id: string; horario: string; nome: string; whatsapp: string; status: string; leadId: string | null };

export async function getAgendaHoje(admin: Supabase): Promise<AgendamentoHoje[]> {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("agendamentos")
    .select("id, horario, nome, whatsapp, status, lead_id")
    .eq("data_agendada", hojeISO)
    .eq("status", "confirmado")
    .order("horario", { ascending: true });

  return ((data ?? []) as { id: string; horario: string; nome: string; whatsapp: string; status: string; lead_id: string | null }[]).map((a) => ({
    id: a.id,
    horario: a.horario,
    nome: a.nome,
    whatsapp: a.whatsapp,
    status: a.status,
    leadId: a.lead_id,
  }));
}

// ===== PARTE 6 — Campanhas ativas =====

export type CampanhaAtiva = { id: string; titulo: string; slug: string; leadsCaptados: number; criadaEm: string };

export async function getCampanhasAtivas(admin: Supabase): Promise<CampanhaAtiva[]> {
  // status real é 'ativa' (ver CAMPANHA_PAGINA_STATUSES) — a tarefa pedia 'ativo' (masculino),
  // que não existe no enum.
  const { data: paginas } = await admin
    .from("campanha_paginas")
    .select("id, titulo, slug, created_at")
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(5);

  const lista = (paginas ?? []) as { id: string; titulo: string; slug: string; created_at: string }[];
  if (lista.length === 0) return [];

  // campanha_respostas não tem coluna "campanha_id" (a tarefa supunha isso) — o vínculo real é
  // pagina_id, FK pra campanha_paginas.id (confirmado em supabase/migrations/20260918100000).
  const contagens = await Promise.all(
    lista.map((pagina) => admin.from("campanha_respostas").select("id", { count: "exact", head: true }).eq("pagina_id", pagina.id)),
  );

  return lista.map((pagina, i) => ({
    id: pagina.id,
    titulo: pagina.titulo,
    slug: pagina.slug,
    leadsCaptados: contagens[i].count ?? 0,
    criadaEm: pagina.created_at,
  }));
}

// ===== PARTE 7 — Retornos pendentes =====

export type RetornoPendenteDashboard = {
  id: string;
  nome: string;
  proximoContato: string;
  vencido: boolean;
  responsavelNome: string | null;
};

export async function getRetornosPendentesDashboard(admin: Supabase): Promise<RetornoPendenteDashboard[]> {
  const agora = new Date();
  // "proximo_contato <= HOJE" (texto da tarefa) = até o fim do dia de hoje, não só até o
  // instante exato de agora — senão um retorno marcado pra mais tarde hoje já não apareceria.
  // "vencido" (vermelho) é o critério mais estrito: já passou do horário exato.
  const fimDeHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999).toISOString();
  const { data } = await admin
    .from("leads")
    .select("id, nome, proximo_contato, profiles!leads_responsavel_id_fkey(full_name)")
    .not("proximo_contato", "is", null)
    .lte("proximo_contato", fimDeHoje)
    .not("kanban_coluna", "in", "(matriculado,perdido)")
    .order("proximo_contato", { ascending: true })
    .limit(10);

  type Linha = { id: string; nome: string; proximo_contato: string; profiles: { full_name: string | null } | null };
  return ((data ?? []) as unknown as Linha[]).map((lead) => ({
    id: lead.id,
    nome: lead.nome,
    proximoContato: lead.proximo_contato,
    vencido: new Date(lead.proximo_contato) < new Date(),
    responsavelNome: lead.profiles?.full_name ?? null,
  }));
}
