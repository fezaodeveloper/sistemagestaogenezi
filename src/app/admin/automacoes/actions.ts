"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reprocessarEvento } from "@/lib/automacoes/motor";
import type { EventoAutomacao } from "@/lib/automacoes/schema";
import {
  getAlunosSemLembreteAula,
  getDiagnosticoTurma,
  getHistoricoNotificacoes,
  getTurmasAtivasParaSelect,
  getVisaoGeralAuditoria,
} from "@/lib/relatorios/auditoria-notificacoes";
import type { FiltrosHistorico } from "@/lib/relatorios/auditoria-notificacoes-shared";
import { enviarLembreteAulaWhatsappAction } from "@/app/admin/matriculas/actions";

export type GetEventosAutomacaoParams = {
  page?: number;
  limit?: number;
  tipo?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
};

export async function getEventosAutomacao(
  params: GetEventosAutomacaoParams,
): Promise<{ eventos: EventoAutomacao[]; total: number }> {
  await requireRole("admin");

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase
    .from("eventos_automacao")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.tipo) query = query.eq("tipo", params.tipo);
  if (params.status) query = query.eq("status", params.status);
  if (params.dataInicio) query = query.gte("created_at", `${params.dataInicio}T00:00:00.000Z`);
  if (params.dataFim) query = query.lte("created_at", `${params.dataFim}T23:59:59.999Z`);

  const { data, count } = await query.range(offset, offset + limit - 1);

  return { eventos: (data as EventoAutomacao[] | null) ?? [], total: count ?? 0 };
}

export async function reprocessarEventoAction(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  await reprocessarEvento(id);

  revalidatePath("/admin/automacoes");
  return {};
}

// ===== Auditoria de notificações (TAREFA) =====

export async function getVisaoGeralAuditoriaAction() {
  await requireRole("admin");
  return getVisaoGeralAuditoria(createAdminClient());
}

export async function getAlunosSemLembreteAulaAction() {
  await requireRole("admin");
  return getAlunosSemLembreteAula(createAdminClient());
}

export async function getTurmasAtivasParaSelectAction() {
  await requireRole("admin");
  return getTurmasAtivasParaSelect(createAdminClient());
}

export async function getDiagnosticoTurmaAction(turmaId: string) {
  await requireRole("admin");
  return getDiagnosticoTurma(createAdminClient(), turmaId);
}

export async function getHistoricoNotificacoesAction(filtros: FiltrosHistorico) {
  await requireRole("admin");
  return getHistoricoNotificacoes(createAdminClient(), filtros);
}

export type EnviarLembreteLoteResultado = { enviados: number; erros: number };

// "Enviar para todos sem lembrete" — reaproveita a mesma Server Action do dropdown de WhatsApp
// (lista de matrículas), que já resolve a próxima aula da turma e loga em mensagens_enviadas.
// Sequencial de propósito (enviarWhatsApp já embute o delay anti-banimento) — mesmo critério de
// todo outro envio em massa deste projeto.
export async function enviarLembreteAulaEmLoteAction(matriculaIds: string[]): Promise<EnviarLembreteLoteResultado> {
  await requireRole("admin");

  let enviados = 0;
  let erros = 0;
  for (const matriculaId of matriculaIds) {
    const resultado = await enviarLembreteAulaWhatsappAction(matriculaId);
    if ("error" in resultado) erros++;
    else enviados++;
  }

  revalidatePath("/admin/automacoes");
  return { enviados, erros };
}
