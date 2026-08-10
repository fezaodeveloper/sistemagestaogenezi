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
