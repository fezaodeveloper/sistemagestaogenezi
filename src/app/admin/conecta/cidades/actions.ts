"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cidadeConectaSchema, type CidadeConecta } from "@/lib/conecta/schema";

export async function getCidadesAdmin(): Promise<CidadeConecta[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("conecta_cidades")
    .select("*")
    .order("estado", { ascending: true })
    .order("ordem", { ascending: true });

  return (data as CidadeConecta[] | null) ?? [];
}

export async function adicionarCidade(nome: string, estado: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const parsed = cidadeConectaSchema.safeParse({ nome, estado });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").insert({
    nome: parsed.data.nome,
    estado: parsed.data.estado,
  });

  if (error) {
    // 23505 = violação da constraint unique (nome, estado).
    const message =
      error.code === "23505" ? "Essa cidade já está cadastrada nesse estado." : "Não foi possível adicionar a cidade. Tente novamente.";
    return { error: message };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}

// Lista dinâmica de estados já cadastrados — não fixa em SE/AL, pra
// suportar o filtro de estado da tela de cidades crescer junto com o que
// for cadastrado (TAREFA 2). Sem .distinct() nativo simples pra uma coluna
// só no supabase-js: a tabela é pequena (cidades aprovadas), então buscar
// tudo e deduplicar em JS é suficiente.
export async function getEstadosDisponiveis(): Promise<string[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("conecta_cidades").select("estado");

  const estados = new Set((data ?? []).map((linha) => linha.estado as string));
  return [...estados].sort();
}

export async function toggleCidadeAtiva(id: string, ativa: boolean): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").update({ ativa }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar a cidade. Tente novamente." };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}

// Sem .eq()/filtro nenhum de propósito: atualiza todas as linhas que a RLS
// permitir (policy "Admins gerenciam cidades" cobre qualquer linha pra um
// admin) — é exatamente o "ativar/desativar tudo de uma vez" pedido.
export async function ativarTodasCidades(): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").update({ ativa: true });

  if (error) {
    return { error: "Não foi possível ativar todas as cidades. Tente novamente." };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}

export async function desativarTodasCidades(): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").update({ ativa: false });

  if (error) {
    return { error: "Não foi possível desativar todas as cidades. Tente novamente." };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}

export async function ativarCidadesPorEstado(estado: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").update({ ativa: true }).eq("estado", estado);

  if (error) {
    return { error: "Não foi possível ativar as cidades deste estado. Tente novamente." };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}

export async function desativarCidadesPorEstado(estado: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").update({ ativa: false }).eq("estado", estado);

  if (error) {
    return { error: "Não foi possível desativar as cidades deste estado. Tente novamente." };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}

export async function excluirCidade(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("conecta_cidades").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a cidade. Tente novamente." };
  }

  revalidatePath("/admin/conecta/cidades");
  return {};
}
