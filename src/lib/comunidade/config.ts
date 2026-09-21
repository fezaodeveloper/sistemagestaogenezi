import "server-only";

import { notFound } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConfigComunidade = { ativo: boolean; alunosExcluem: boolean };

// Lê as flags pela sessão de quem chama (authenticated lê `configuracoes`). Erro — por
// exemplo migration ainda não aplicada — = recurso DESLIGADO: nunca lança, o layout do aluno
// continua funcionando e o menu "Comunidade" simplesmente não aparece.
export async function getConfigComunidade(supabase: SupabaseServerClient): Promise<ConfigComunidade> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("portal_comunidade_ativo, portal_comunidade_alunos_excluem")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return { ativo: false, alunosExcluem: true };
  return {
    ativo: data.portal_comunidade_ativo === true,
    alunosExcluem: data.portal_comunidade_alunos_excluem !== false,
  };
}

// Porta de entrada de toda página de /aluno/comunidade: recurso desligado = 404 (a rota
// simplesmente não existe pro aluno). Cada page.tsx chama isto além de requireRole().
export async function exigirComunidadeAtiva(supabase: SupabaseServerClient): Promise<ConfigComunidade> {
  const config = await getConfigComunidade(supabase);
  if (!config.ativo) notFound();
  return config;
}
