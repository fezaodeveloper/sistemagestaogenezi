"use server";

import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Sem checagem manual de "essa notificação é da minha empresa" — a policy
// "Empresa marca como lida" (RLS) já escopa o UPDATE pela própria empresa;
// um id de outra empresa simplesmente não afeta nenhuma linha.
export async function marcarNotificacaoLida(id: string): Promise<{ error?: string }> {
  await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes_empresa").update({ lida: true }).eq("id", id);

  if (error) {
    return { error: "Não foi possível marcar como lida. Tente novamente." };
  }

  revalidatePath("/empresa/notificacoes");
  return {};
}
