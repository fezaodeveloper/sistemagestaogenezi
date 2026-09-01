"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ContratoAssinado } from "@/lib/contratos/schema";

// Um aluno pode ter mais de uma matrícula (logo mais de um contrato) — a
// tela mostra o mais recente, mesma simplificação de escopo assumida em
// getMeusCertificados (não há uma tela de lista de contratos, só "o meu
// contrato").
export async function getContratoAluno(): Promise<ContratoAssinado | null> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("contratos_assinados")
    .select("*")
    .eq("aluno_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ContratoAssinado | null) ?? null;
}

export async function assinarContrato(matriculaId: string): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("contratos_assinados")
    .update({
      status: "aceito",
      aceito_em: new Date().toISOString(),
      aceito_ip: ip,
    })
    .eq("matricula_id", matriculaId)
    .eq("aluno_id", user.id);

  if (error) {
    return { error: "Não foi possível registrar a assinatura. Tente novamente." };
  }

  revalidatePath("/aluno/contrato");
  return {};
}
