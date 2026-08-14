"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { enviarMensagem, marcarComoLidas } from "@/lib/chat/chat";
import { mensagemFormSchema } from "@/lib/chat/schema";

export async function enviarMensagemAluno(
  conversaId: string,
  texto: string,
): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const parsed = mensagemFormSchema.safeParse({ texto });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = await createClient();
  return enviarMensagem(supabase, conversaId, user.id, parsed.data.texto);
}

export async function marcarConversaLidaAluno(conversaId: string): Promise<void> {
  await requireRole("aluno");
  const supabase = await createClient();
  await marcarComoLidas(supabase, conversaId);
}
