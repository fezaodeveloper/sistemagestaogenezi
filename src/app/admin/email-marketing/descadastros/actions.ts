"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { reativarEmail } from "@/lib/email/descadastro";
import { createAdminClient } from "@/lib/supabase/admin";

// "Remover da lista": o e-mail volta a poder receber campanhas. Roda com o client admin
// (service_role) porque authenticated só tem SELECT em email_descadastros.
export async function removerDescadastro(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Registro inválido." };

  const admin = createAdminClient();
  const { data } = await admin.from("email_descadastros").select("email").eq("id", id).maybeSingle();
  if (!data?.email) return { error: "Este e-mail já não está na lista." };

  const resultado = await reativarEmail(data.email as string);
  if (!resultado.ok) return { error: resultado.erro ?? "Não foi possível reativar o e-mail." };

  revalidatePath("/admin/email-marketing/descadastros");
  revalidatePath("/admin/email-marketing");
  return {};
}
