import { requireRole } from "@/lib/auth/dal";
import { getGastos } from "@/app/admin/financeiro/gastos/actions";
import { GastosView } from "@/components/admin/gastos-view";

export default async function GastosPage() {
  await requireRole("admin");

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const gastos = await getGastos(ano, mes);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Gastos</h1>
        <p className="text-muted-foreground text-sm">Despesas da escola por categoria e mês.</p>
      </div>
      <GastosView gastosIniciais={gastos} anoInicial={ano} mesInicial={mes} />
    </div>
  );
}
