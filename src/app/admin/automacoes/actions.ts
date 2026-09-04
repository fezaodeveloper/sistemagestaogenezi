"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { reprocessarEvento } from "@/lib/automacoes/motor";
import type { EventoAutomacao } from "@/lib/automacoes/schema";

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
