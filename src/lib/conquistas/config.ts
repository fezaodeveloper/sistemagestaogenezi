import "server-only";

import { notFound } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Flag "Habilitar conquistas". Erro — por exemplo migration ainda não aplicada — = DESLIGADO:
// nunca lança, o layout do aluno segue funcionando e o menu simplesmente não aparece.
export async function getConquistasAtivo(supabase: SupabaseServerClient): Promise<boolean> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("portal_conquistas_ativo")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return false;
  return data.portal_conquistas_ativo === true;
}

// Porta de entrada de /aluno/conquistas: recurso desligado = 404.
export async function exigirConquistasAtivo(supabase: SupabaseServerClient): Promise<void> {
  if (!(await getConquistasAtivo(supabase))) notFound();
}
