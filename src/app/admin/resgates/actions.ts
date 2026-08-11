"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function marcarResgateEntregue(id: string): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("resgates")
    .update({ status: "entregue", entregue_em: new Date().toISOString(), entregue_por: user.id })
    .eq("id", id)
    .eq("status", "pendente"); // evita marcar de novo algo que já não está mais pendente

  if (error) {
    return { error: "Não foi possível marcar o resgate como entregue." };
  }

  revalidatePath("/admin/resgates");
  return {};
}
