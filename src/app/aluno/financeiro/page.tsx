import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlunoFinanceiroView, type ParcelaAlunoRow } from "@/components/aluno/aluno-financeiro-view";

export default async function AlunoFinanceiroPage() {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  const { data } = await supabase
    .from("parcelas")
    .select(
      "id, numero_parcela, valor, data_vencimento, data_pagamento, status, asaas_invoice_url, asaas_bank_slip_url, matriculas(turmas(cursos(nome)))",
    )
    .eq("aluno_id", user.id)
    .order("data_vencimento", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu Financeiro</h1>
        <p className="text-muted-foreground text-sm">Acompanhe suas mensalidades e pagamentos.</p>
      </div>
      <AlunoFinanceiroView parcelas={(data as unknown as ParcelaAlunoRow[] | null) ?? []} />
    </div>
  );
}
