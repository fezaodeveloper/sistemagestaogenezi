"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { reprocessarEvento } from "@/lib/automacoes/motor";
import type { EventoAutomacao } from "@/lib/automacoes/schema";

export async function getEventosAutomacao(
  paginacao: { offset: number; limite: number },
): Promise<{ itens: EventoAutomacao[]; total: number }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("eventos_automacao")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(paginacao.offset, paginacao.offset + paginacao.limite - 1);

  return { itens: (data as EventoAutomacao[] | null) ?? [], total: count ?? 0 };
}

export async function reprocessarEventoAction(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  await reprocessarEvento(id);

  revalidatePath("/admin/automacoes");
  return {};
}
