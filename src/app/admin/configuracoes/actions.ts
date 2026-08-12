"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function updateEadGamificacao(ativo: boolean): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({ ead_participa_gamificacao: ativo, updated_by: user.id })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}

export async function updateCriteriosCertificado(
  notaMinima: number,
  frequenciaMinima: number,
): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  if (
    !Number.isInteger(notaMinima) ||
    notaMinima < 0 ||
    notaMinima > 100 ||
    !Number.isInteger(frequenciaMinima) ||
    frequenciaMinima < 0 ||
    frequenciaMinima > 100
  ) {
    return { error: "Os percentuais precisam ser números inteiros entre 0 e 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      certificado_nota_minima_percentual: notaMinima,
      certificado_frequencia_minima_percentual: frequenciaMinima,
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return {};
}
