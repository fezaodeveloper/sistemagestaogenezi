import { requireRole } from "@/lib/auth/dal";
import { RelatorioFinanceiroView } from "@/components/admin/relatorio-financeiro-view";

export default async function RelatorioFinanceiroPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatório Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Receitas, gastos, saldo e inadimplência por mês.
        </p>
      </div>
      <RelatorioFinanceiroView />
    </div>
  );
}
