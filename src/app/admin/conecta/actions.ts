"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmpresaConecta } from "@/lib/conecta/schema";

export async function getEmpresasConecta(): Promise<EmpresaConecta[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas_conecta")
    .select("*")
    .order("created_at", { ascending: false });

  return (data as EmpresaConecta[] | null) ?? [];
}

export async function aprovarEmpresa(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas_conecta")
    .update({ status: "ativa", aprovada_em: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível aprovar a empresa. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}

export async function suspenderEmpresa(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("empresas_conecta").update({ status: "suspensa" }).eq("id", id);

  if (error) {
    return { error: "Não foi possível suspender a empresa. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}

// Client admin de propósito: a migration (mostrada, não aplicada) só dá
// grant de DELETE em empresas_conecta pra service_role, não pra
// authenticated — mesmo padrão já usado em deleteAluno (auth.admin.deleteUser
// também exige o client admin).
export async function excluirEmpresa(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { error } = await admin.from("empresas_conecta").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a empresa. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}

export async function enviarNotificacaoEmpresa(
  empresaId: string,
  titulo: string,
  mensagem: string,
): Promise<{ error?: string }> {
  const admin = await requireRole("admin");

  if (!titulo.trim() || !mensagem.trim()) {
    return { error: "Preencha título e mensagem." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes_empresa").insert({
    empresa_id: empresaId,
    titulo: titulo.trim(),
    mensagem: mensagem.trim(),
    created_by: admin.id,
  });

  if (error) {
    return { error: "Não foi possível enviar a notificação. Tente novamente." };
  }

  revalidatePath("/admin/conecta");
  return {};
}
