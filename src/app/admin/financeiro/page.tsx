import { requireRole } from "@/lib/auth/dal";
import { getFinanceiroDados, getMatriculasParaParcela } from "@/app/admin/financeiro/actions";
import { FinanceiroView } from "@/components/admin/financeiro-view";

export default async function FinanceiroPage() {
  await requireRole("admin");

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const [dados, matriculas] = await Promise.all([
    getFinanceiroDados(ano, mes),
    getMatriculasParaParcela(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Mensalidades, cobranças e recebimentos das matrículas.
        </p>
      </div>
      <FinanceiroView
        dadosIniciais={dados}
        anoInicial={ano}
        mesInicial={mes}
        matriculas={matriculas}
      />
    </div>
  );
}
