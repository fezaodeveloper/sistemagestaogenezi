import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { EmpresaConecta, NotificacaoEmpresa, VagaConecta } from "@/lib/conecta/schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getEmpresaPorProfileId(
  supabase: SupabaseServerClient,
  profileId: string,
): Promise<EmpresaConecta | null> {
  const { data } = await supabase
    .from("empresas_conecta")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  return (data as EmpresaConecta | null) ?? null;
}

export async function getVagasDaEmpresa(
  supabase: SupabaseServerClient,
  empresaId: string,
): Promise<VagaConecta[]> {
  const { data } = await supabase
    .from("vagas_conecta")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  return (data as VagaConecta[] | null) ?? [];
}

export async function getContagemVagasAtivas(
  supabase: SupabaseServerClient,
  empresaId: string,
): Promise<number> {
  const { count } = await supabase
    .from("vagas_conecta")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativa");

  return count ?? 0;
}

export async function getNotificacoesDaEmpresa(
  supabase: SupabaseServerClient,
  empresaId: string,
): Promise<NotificacaoEmpresa[]> {
  const { data } = await supabase
    .from("notificacoes_empresa")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  return (data as NotificacaoEmpresa[] | null) ?? [];
}

export async function getContagemNotificacoesNaoLidas(
  supabase: SupabaseServerClient,
  empresaId: string,
): Promise<number> {
  const { count } = await supabase
    .from("notificacoes_empresa")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("lida", false);

  return count ?? 0;
}

// empresaId não entra no filtro — visibilidade de candidato não é por
// empresa, é geral (RLS "Empresas veem perfis visiveis e ativos" já
// restringe o que qualquer empresa autenticada enxerga aqui). O `.or`
// abaixo é redundante com a RLS (que já aplica exatamente essa condição),
// mas mantido explícito pra o código não depender só da policy pra ficar
// correto.
export async function getContagemCandidatosDisponiveis(supabase: SupabaseServerClient): Promise<number> {
  const { count } = await supabase
    .from("perfis_conecta")
    .select("id", { count: "exact", head: true })
    .eq("visivel", true)
    .or("tipo.eq.aluno,esta_ativo.eq.true");

  return count ?? 0;
}
