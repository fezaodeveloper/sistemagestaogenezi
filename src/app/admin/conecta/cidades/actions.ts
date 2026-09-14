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
