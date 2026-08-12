"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emitirCertificado } from "@/lib/certificados/emitir";

// A leitura abaixo roda com o client do próprio aluno (RLS restringe a
// linha à matrícula dele) — é essa leitura, não nada vindo do client, que
// decide se o certificado está liberado e ainda não emitido. A geração em
// si roda dentro de emitirCertificado(), sempre via service_role, mesma
// function reaproveitada pela emissão automática (EAD) e manual (admin).
export async function emitirCertificadoProprio(certificadoId: string): Promise<{ error?: string }> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { data: certificado } = await supabase
    .from("certificados")
    .select("id, status, liberado")
    .eq("id", certificadoId)
    .single();

  if (!certificado) {
    return { error: "Certificado não encontrado." };
  }
  if (!certificado.liberado) {
    return { error: "Este certificado ainda não foi liberado pela administração." };
  }
  if (certificado.status === "emitido") {
    return {};
  }

  const result = await emitirCertificado(certificadoId, null);
  if (result.error) return result;

  revalidatePath("/aluno/certificados");
  return {};
}
