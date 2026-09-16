"use server";

import { requireRole } from "@/lib/auth/dal";
import { enviarPushAlunos } from "@/lib/push/enviar";
import { notificacaoPushSchema } from "@/lib/push/schema";

export type EnviarNotificacaoResultado = { success: true; quantidade: number } | { error: string };

export async function enviarNotificacaoPush(formData: FormData): Promise<EnviarNotificacaoResultado> {
  await requireRole("admin");

  const parsed = notificacaoPushSchema.safeParse({
    titulo: formData.get("titulo"),
    corpo: formData.get("corpo"),
    url: formData.get("url"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const quantidade = await enviarPushAlunos(parsed.data.titulo, parsed.data.corpo, parsed.data.url);
  return { success: true, quantidade };
}
