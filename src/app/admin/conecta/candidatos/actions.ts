"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cancelarAssinaturaConecta } from "@/lib/asaas/client";
import type {
  AlunoVisivelConecta,
  AlunosVisiveisFiltro,
  AlunosVisiveisResultado,
  CandidatosExternosFiltro,
  CandidatosExternosResultado,
  PerfilConecta,
} from "@/lib/conecta/schema";

const LIMITE_PADRAO = 20;

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

type PerfilAlunoRow = {
  id: string;
  aluno_id: string | null;
  whatsapp: string | null;
  cidade: string | null;
  disponibilidade: AlunoVisivelConecta["disponibilidade"];
  visivel: boolean;
  updated_at: string;
  alunos: { profiles: { full_name: string | null } | null } | null;
};

// Nome vem de alunos->profiles, não de perfis_conecta.nome (essa coluna é
// só pra candidatos EXTERNOS, ver comentário na migration/schema) — mesmo
// join já usado em getCandidatosDisponiveis (portal da empresa), aqui via
// client autenticado normal porque admin já tem RLS "is_admin()" liberando
// select em perfis_conecta/alunos/profiles (não precisa do bypass de
// service_role que a empresa precisa).
// Filtro de busca e paginação em JS pelo mesmo motivo de
// getVagasAdminConecta: nome vem de uma tabela embutida (join aninhado),
// não dá pra `ilike` direto nela combinado com paginação confiável.
export async function listarAlunosVisiveisConecta(
  filtro: AlunosVisiveisFiltro = {},
): Promise<AlunosVisiveisResultado> {
  await requireRole("admin");

  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;

  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis_conecta")
    .select(
      "id, aluno_id, whatsapp, cidade, disponibilidade, visivel, updated_at, alunos(profiles!alunos_id_fkey(full_name))",
    )
    .eq("tipo", "aluno")
    .eq("visivel", true)
    .order("updated_at", { ascending: false });

  const perfis = (data as unknown as PerfilAlunoRow[] | null) ?? [];
  const alunoIds = perfis.map((p) => p.aluno_id).filter((id): id is string => Boolean(id));

  const cursosPorAluno = new Map<string, Set<string>>();
  if (alunoIds.length > 0) {
    const { data: matriculasData } = await supabase
      .from("matriculas")
      .select("aluno_id, turmas(cursos(nome))")
      .in("aluno_id", alunoIds)
      .eq("status", "concluida");

    type MatriculaRow = { aluno_id: string; turmas: { cursos: { nome: string } | null } | null };
    for (const row of (matriculasData as unknown as MatriculaRow[] | null) ?? []) {
      const nome = row.turmas?.cursos?.nome;
      if (!nome) continue;
      const atual = cursosPorAluno.get(row.aluno_id) ?? new Set<string>();
      atual.add(nome);
      cursosPorAluno.set(row.aluno_id, atual);
    }
  }

  const todos: AlunoVisivelConecta[] = perfis.map((perfil) => ({
    id: perfil.id,
    alunoId: perfil.aluno_id,
    nome: perfil.alunos?.profiles?.full_name ?? "Aluno",
    whatsapp: perfil.whatsapp,
    cidade: perfil.cidade,
    disponibilidade: perfil.disponibilidade,
    visivel: perfil.visivel,
    cursosConcluidos: perfil.aluno_id
      ? [...(cursosPorAluno.get(perfil.aluno_id) ?? [])].sort((a, b) => a.localeCompare(b))
      : [],
  }));

  const termo = filtro.query?.trim().toLowerCase();
  const filtrados = termo ? todos.filter((aluno) => aluno.nome.toLowerCase().includes(termo)) : todos;

  const total = filtrados.length;
  const offset = (page - 1) * limit;

  return { alunos: filtrados.slice(offset, offset + limit), total };
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
