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
