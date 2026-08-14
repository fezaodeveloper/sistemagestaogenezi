"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { criarConversa, enviarMensagem, marcarComoLidas, getConversaPorAluno } from "@/lib/chat/chat";
import { mensagemFormSchema } from "@/lib/chat/schema";

// Abre a conversa existente do aluno, ou cria na hora se ainda não
// houver uma — o Select de "nova conversa" na listagem e o atalho do
// painel do professor levam pro mesmo lugar (/admin/chat/[alunoId]),
// então esse ponto de entrada precisa lidar com os dois casos.
export async function iniciarOuAbrirConversaAdmin(alunoId: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const supabase = await createClient();

  const existente = await getConversaPorAluno(supabase, alunoId);
  if (!existente) {
    const result = await criarConversa(supabase, alunoId);
    if ("error" in result) return result;
    revalidatePath("/admin/chat");
  }

  redirect(`/admin/chat/${alunoId}`);
}

export async function enviarMensagemAdmin(
  conversaId: string,
  texto: string,
): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const parsed = mensagemFormSchema.safeParse({ texto });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = await createClient();
  return enviarMensagem(supabase, conversaId, user.id, parsed.data.texto);
}

export async function marcarConversaLidaAdmin(conversaId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await marcarComoLidas(supabase, conversaId);
  revalidatePath("/admin/chat");
}
