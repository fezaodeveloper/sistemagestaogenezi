import { requireRole } from "@/lib/auth/dal";
import { getCategorias } from "@/app/admin/financeiro/categorias/actions";
import { CategoriasFinanceiroView } from "@/components/admin/categorias-financeiro-view";

export default async function CategoriasFinanceiroPage() {
  await requireRole("admin");

  const [categoriasGastos, categoriasAvulsos] = await Promise.all([
    getCategorias("categorias_gastos"),
    getCategorias("categorias_avulsos"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Categorias Financeiras</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as categorias usadas nos formulários de gastos e pagamentos avulsos.
        </p>
      </div>
      <CategoriasFinanceiroView
        categoriasGastosIniciais={categoriasGastos}
        categoriasAvulsosIniciais={categoriasAvulsos}
      />
    </div>
  );
}
