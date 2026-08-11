"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// As duas functions (resgatar_curso_bonus/resgatar_premio_fisico) já
// levantam mensagens em português pensadas pra aparecer direto pro
// aluno ("Créditos insuficientes...", "Você já atingiu o limite...") —
// diferente do padrão genérico usado em outras actions, aqui repassar o
// texto da exceção é a experiência certa: o aluno precisa saber POR QUE
// o resgate falhou, não só que falhou.

export async function resgatarCursoBonus(cursoId: string): Promise<{ error?: string }> {
  await requireRole("aluno");
  const supabase = await createClient();

  const { error } = await supabase.rpc("resgatar_curso_bonus", { p_curso_id: cursoId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/aluno/creditos");
  revalidatePath("/aluno");
  return {};
}

export async function resgatarPremioFisico(premioId: string): Promise<{ error?: string }> {
  await requireRole("aluno");
  const supabase = await createClient();

  const { error } = await supabase.rpc("resgatar_premio_fisico", { p_premio_id: premioId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/aluno/creditos");
  return {};
}
