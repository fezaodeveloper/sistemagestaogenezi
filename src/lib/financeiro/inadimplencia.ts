import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StatusInadimplencia = {
  inadimplente: boolean;
  parcelasAtrasadas: number;
  vencimentoMaisAntigo: string | null;
};

// Consulta direto pelo client admin (bypassa RLS) — chamado a partir do
// próprio portal do aluno (aluno/page.tsx), então não dá pra usar o client
// autenticado normal sabendo que a policy de parcelas já libera o aluno ver
// as próprias linhas; mas aqui é sempre com o id já resolvido via
// requireRole (nunca input de usuário), então o bypass é seguro. Status
// vem do banco (sincronizado pelo cron de atraso existente), não consulta o
// Asaas em tempo real.
export async function verificarInadimplenciaAluno(alunoId: string): Promise<StatusInadimplencia> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("parcelas")
    .select("data_vencimento")
    .eq("aluno_id", alunoId)
    .eq("status", "atrasado")
    .order("data_vencimento", { ascending: true });

  const parcelas = data ?? [];

  return {
    inadimplente: parcelas.length > 0,
    parcelasAtrasadas: parcelas.length,
    vencimentoMaisAntigo: parcelas[0]?.data_vencimento ?? null,
  };
}
