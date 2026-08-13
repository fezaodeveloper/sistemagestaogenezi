"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { reenviarMensagemFalha } from "@/lib/mensagens/mensagens";

export async function reenviarMensagem(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const result = await reenviarMensagemFalha(id);

  revalidatePath("/admin/mensagens");
  return result;
}
