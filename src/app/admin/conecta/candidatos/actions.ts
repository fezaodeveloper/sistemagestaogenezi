"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cancelarAssinaturaConecta } from "@/lib/asaas/client";
import type { CandidatosExternosFiltro, CandidatosExternosResultado, PerfilConecta } from "@/lib/conecta/schema";

const LIMITE_PADRAO = 12;

export async function listarCandidatosExternos(
  filtro: CandidatosExternosFiltro = {},
): Promise<CandidatosExternosResultado> {
  await requireRole("admin");

  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase.from("perfis_conecta").select("*", { count: "exact" }).eq("tipo", "externo");

  const termo = filtro.query?.trim();
  if (termo) {
    query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { candidatos: (data as PerfilConecta[] | null) ?? [], total: count ?? 0 };
}

// Cancela no Asaas (best-effort — se a assinatura já não existir lá, ainda
// assim o perfil local é desativado) e já reflete o cancelamento localmente
// em vez de esperar o webhook SUBSCRIPTION_DELETED, pra o admin ver o efeito
// na hora.
export async function cancelarAssinaturaCandidato(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_conecta")
    .select("asaas_subscription_id")
    .eq("id", id)
    .maybeSingle();

  if (perfil?.asaas_subscription_id) {
    try {
      await cancelarAssinaturaConecta(perfil.asaas_subscription_id);
    } catch {
      // Best-effort — segue pra desativar o perfil local mesmo se a
      // assinatura já não existir mais no Asaas.
    }
  }

  const { error } = await supabase
    .from("perfis_conecta")
    .update({ esta_ativo: false, visivel: false })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível cancelar a assinatura. Tente novamente." };
  }

  revalidatePath("/admin/conecta/candidatos");
  return {};
}
