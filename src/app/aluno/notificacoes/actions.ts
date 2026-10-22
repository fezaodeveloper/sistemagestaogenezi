"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type NotificacaoAluno = {
  id: string;
  titulo: string;
  corpo: string | null;
  lida: boolean;
  created_at: string;
};

// Últimas 50 — sininho, não uma tela de histórico completo. RLS já restringe a leitura às
// próprias notificações (aluno_id = auth.uid()), sem precisar repetir o filtro aqui.
export async function getNotificacoesAluno(): Promise<NotificacaoAluno[]> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notificacoes_aluno")
    .select("id, titulo, corpo, lida, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as NotificacaoAluno[];
}

export async function marcarComoLida(id: string): Promise<{ error?: string }> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes_aluno").update({ lida: true }).eq("id", id);

  if (error) {
    return { error: "Não foi possível marcar como lida. Tente novamente." };
  }

  revalidatePath("/aluno");
  return {};
}

export async function marcarTodasComoLidas(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes_aluno")
    .update({ lida: true })
    .eq("aluno_id", user.id)
    .eq("lida", false);

  if (error) {
    return { error: "Não foi possível marcar as notificações como lidas. Tente novamente." };
  }

  revalidatePath("/aluno");
  return {};
}

export async function excluirNotificacao(id: string): Promise<{ error?: string }> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes_aluno").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a notificação. Tente novamente." };
  }

  revalidatePath("/aluno");
  return {};
}

export async function excluirNotificacoesLidas(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes_aluno")
    .delete()
    .eq("aluno_id", user.id)
    .eq("lida", true);

  if (error) {
    return { error: "Não foi possível limpar as notificações lidas. Tente novamente." };
  }

  revalidatePath("/aluno");
  return {};
}
