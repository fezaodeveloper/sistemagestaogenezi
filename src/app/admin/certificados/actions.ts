"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Libera um ou vários certificados de uma vez (checkbox individual ou
// "selecionar todos" na fila) — o admin só destrava; quem gera o PDF a
// partir daqui é o próprio aluno, em emitirCertificadoProprio.
export async function liberarCertificados(ids: string[]): Promise<{ error?: string }> {
  await requireRole("admin");

  if (ids.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("certificados")
    .update({ liberado: true })
    .in("id", ids)
    .eq("liberado", false);

  if (error) {
    return { error: "Não foi possível liberar os certificados selecionados." };
  }

  revalidatePath("/admin/certificados");
  revalidatePath("/admin");
  return {};
}
