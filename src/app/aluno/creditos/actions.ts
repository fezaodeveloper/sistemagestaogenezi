"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dispararEvento } from "@/lib/automacoes/motor";

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
  const user = await requireRole("aluno");
  const supabase = await createClient();

  // Busca os dados do prêmio antes do RPC — resgatar_premio_fisico (Postgres
  // function) não retorna a linha criada em resgates, só sucesso/erro, então
  // é aqui que precisamos capturar nome/custo pra notificação abaixo.
  const { data: premio } = await supabase
    .from("premios")
    .select("nome, custo_creditos")
    .eq("id", premioId)
    .single();

  const { error } = await supabase.rpc("resgatar_premio_fisico", { p_premio_id: premioId });
  if (error) {
    return { error: error.message };
  }

  await dispararEvento(
    "resgate.novo",
    {
      nome_aluno: user.full_name ?? user.email ?? "—",
      nome_premio: premio?.nome ?? "—",
      creditos: premio?.custo_creditos ?? "—",
    },
    `resgate-novo-${premioId}-${user.id}-${Date.now()}`,
  );

  revalidatePath("/aluno/creditos");
  return {};
}
