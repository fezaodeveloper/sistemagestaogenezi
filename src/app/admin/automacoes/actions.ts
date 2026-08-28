"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { reprocessarEvento } from "@/lib/automacoes/motor";
import type { EventoAutomacao } from "@/lib/automacoes/schema";

const LIMITE_EVENTOS = 100;

export async function getEventosAutomacao(): Promise<EventoAutomacao[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("eventos_automacao")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMITE_EVENTOS);

  return (data as EventoAutomacao[] | null) ?? [];
}

export async function reprocessarEventoAction(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  await reprocessarEvento(id);

  revalidatePath("/admin/automacoes");
  return {};
}
