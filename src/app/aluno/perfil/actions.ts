"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_IDS } from "@/lib/avatares/catalog";

const avatarSchema = z.enum(AVATAR_IDS);

export async function updateAvatar(avatarId: string): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const parsed = avatarSchema.safeParse(avatarId);
  if (!parsed.success) {
    return { error: "Avatar inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_id: parsed.data })
    .eq("id", user.id);

  if (error) {
    return { error: "Não foi possível salvar o avatar. Tente novamente." };
  }

  revalidatePath("/aluno/perfil");
  revalidatePath("/aluno");
  revalidatePath("/aluno/ranking");
  return {};
}

// Mesmo padrão do upload de foto pelo admin (src/app/admin/alunos/actions.ts):
// o upload do arquivo acontece do lado do client, direto pro Supabase
// Storage — essa action só grava a URL/path já prontos na própria linha do
// aluno (nunca a de outro aluno: sempre eq("id", user.id), nunca um
// alunoId recebido por parâmetro).
export async function salvarFotoPropria(fotoUrl: string, fotoPath: string): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  if (!fotoUrl || !fotoPath) {
    return { error: "Upload da foto falhou antes de salvar. Tente novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("alunos")
    .update({ foto_url: fotoUrl, foto_path: fotoPath })
    .eq("id", user.id);

  if (error) {
    return { error: "Não foi possível salvar a foto. Tente novamente." };
  }

  revalidatePath("/aluno/perfil");
  return {};
}

export async function removerFotoPropria(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();

  const { data: aluno } = await supabase
    .from("alunos")
    .select("foto_path")
    .eq("id", user.id)
    .single();

  if (aluno?.foto_path) {
    const { error: storageError } = await supabase.storage.from("fotos-alunos").remove([aluno.foto_path]);
    if (storageError) {
      return { error: "Não foi possível remover o arquivo do Storage. Tente novamente." };
    }
  }

  const { error } = await supabase
    .from("alunos")
    .update({ foto_url: null, foto_path: null })
    .eq("id", user.id);

  if (error) {
    return { error: "Arquivo removido do Storage, mas não foi possível atualizar o cadastro. Contate o suporte." };
  }

  revalidatePath("/aluno/perfil");
  return {};
}
