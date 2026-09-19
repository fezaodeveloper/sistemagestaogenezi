"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { acessoRemotoFormSchema, type AcessoRemoto } from "@/lib/acesso-remoto/schema";

export async function getAcessosRemotos(): Promise<AcessoRemoto[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("acesso_remoto").select("*").order("nome_pc");
  return (data as AcessoRemoto[] | null) ?? [];
}

// ===== Balão flutuante de acesso remoto (usado durante as aulas) =====

// Só o necessário pra listar/buscar — a senha NUNCA vai nesta lista.
export type AcessoRemotoResumo = { id: string; nome_pc: string; login: string };

// PCs ativos (id, nome, login), pro balão filtrar em tempo real no navegador.
export async function listarAcessosRemotosParaBalao(): Promise<AcessoRemotoResumo[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("acesso_remoto")
    .select("id, nome_pc, login")
    .eq("ativo", true)
    .order("nome_pc")
    .limit(500);
  return (data as AcessoRemotoResumo[] | null) ?? [];
}

// A senha só é buscada quando o admin escolhe um PC no balão — nunca vai em
// massa pra todas as páginas do painel.
export async function getSenhaAcessoRemoto(id: string): Promise<{ senha: string } | { error: string }> {
  await requireRole("admin");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: "PC inválido." };
  }

  const supabase = await createClient();
  const { data } = await supabase.from("acesso_remoto").select("senha").eq("id", id).eq("ativo", true).maybeSingle();

  if (!data) return { error: "PC não encontrado." };
  return { senha: data.senha as string };
}

export type AcessoRemotoActionResult = { success: true } | { error: string };

function parseAcessoRemotoForm(formData: FormData) {
  return acessoRemotoFormSchema.safeParse({
    nome_pc: formData.get("nome_pc"),
    login: formData.get("login"),
    senha: formData.get("senha"),
    ip: formData.get("ip") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarAcessoRemoto(formData: FormData): Promise<AcessoRemotoActionResult> {
  await requireRole("admin");

  const parsed = parseAcessoRemotoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("acesso_remoto").insert({
    nome_pc: parsed.data.nome_pc,
    login: parsed.data.login,
    senha: parsed.data.senha,
    ip: parsed.data.ip ?? null,
    observacoes: parsed.data.observacoes ?? null,
    ativo: parsed.data.ativo,
  });

  if (error) {
    return { error: "Não foi possível criar o acesso remoto. Tente novamente." };
  }

  revalidatePath("/admin/acesso-remoto");
  return { success: true };
}

export async function atualizarAcessoRemoto(
  id: string,
  formData: FormData,
): Promise<AcessoRemotoActionResult> {
  await requireRole("admin");

  const parsed = parseAcessoRemotoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("acesso_remoto")
    .update({
      nome_pc: parsed.data.nome_pc,
      login: parsed.data.login,
      senha: parsed.data.senha,
      ip: parsed.data.ip ?? null,
      observacoes: parsed.data.observacoes ?? null,
      ativo: parsed.data.ativo,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/acesso-remoto");
  return { success: true };
}

export async function excluirAcessoRemoto(id: string): Promise<AcessoRemotoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("acesso_remoto").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o acesso remoto. Tente novamente." };
  }

  revalidatePath("/admin/acesso-remoto");
  return { success: true };
}
