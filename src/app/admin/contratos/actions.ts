"use server";

import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarWhatsappContratoPendenteLembrete } from "@/lib/whatsapp/eventos";

export type EnviarMensagemContratoPendenteResult = { enviadas: number; erros: number };

type LinhaContratoPendente = {
  id: string;
  aluno_id: string;
  alunos: { telefone: string | null; profiles: { full_name: string | null } | null } | null;
};

// Sequencial de propósito (for...of com await, não Promise.all) — mesmo padrão dos crons de
// cobrança atrasada/follow-up de lead: cada chamada a notificarWhatsappContratoPendenteLembrete
// já embute o delay anti-banimento (src/lib/whatsapp/evolution.ts).
export async function enviarMensagemContratoPendenteAction(): Promise<EnviarMensagemContratoPendenteResult> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("contratos_assinados")
    .select("id, aluno_id, alunos(telefone, profiles!alunos_id_fkey(full_name))")
    .eq("status", "pendente");

  if (error || !data) {
    console.error("[enviarMensagemContratoPendenteAction]", error);
    return { enviadas: 0, erros: 0 };
  }

  let enviadas = 0;
  let erros = 0;
  for (const contrato of data as unknown as LinhaContratoPendente[]) {
    const telefone = contrato.alunos?.telefone;
    if (!telefone) {
      erros++;
      continue;
    }
    const nome = contrato.alunos?.profiles?.full_name ?? "aluno(a)";
    const resultado = await notificarWhatsappContratoPendenteLembrete(telefone, nome);
    if (resultado.ok) enviadas++;
    else erros++;
  }

  return { enviadas, erros };
}
