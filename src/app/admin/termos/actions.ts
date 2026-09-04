"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { termoFormSchema, type Termo } from "@/lib/termos/schema";

export async function getTermos(): Promise<Termo[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("termos").select("*").order("created_at", { ascending: false });
  return (data as Termo[] | null) ?? [];
}

export type TermoActionResult = { success: true } | { error: string };

function parseTermoForm(formData: FormData) {
  return termoFormSchema.safeParse({
    titulo: formData.get("titulo"),
    tipo: formData.get("tipo"),
    conteudo: formData.get("conteudo"),
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarTermo(formData: FormData): Promise<TermoActionResult> {
  await requireRole("admin");

  const parsed = parseTermoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("termos").insert({
    titulo: parsed.data.titulo,
    tipo: parsed.data.tipo,
    conteudo: parsed.data.conteudo,
    ativo: parsed.data.ativo,
  });

  if (error) {
    return { error: "Não foi possível criar o termo. Tente novamente." };
  }

  revalidatePath("/admin/termos");
  return { success: true };
}

export async function atualizarTermo(id: string, formData: FormData): Promise<TermoActionResult> {
  await requireRole("admin");

  const parsed = parseTermoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("termos")
    .update({
      titulo: parsed.data.titulo,
      tipo: parsed.data.tipo,
      conteudo: parsed.data.conteudo,
      ativo: parsed.data.ativo,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/termos");
  return { success: true };
}

export async function excluirTermo(id: string): Promise<TermoActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("termos").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o termo. Tente novamente." };
  }

  revalidatePath("/admin/termos");
  return { success: true };
}
