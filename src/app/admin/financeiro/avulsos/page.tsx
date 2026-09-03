import { requireRole } from "@/lib/auth/dal";
import { getPagamentosAvulsos } from "@/app/admin/financeiro/avulsos/actions";
import { getCategorias } from "@/app/admin/financeiro/categorias/actions";
import { AvulsosView } from "@/components/admin/avulsos-view";

export default async function AvulsosPage() {
  await requireRole("admin");

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const [{ itens: pagamentos, total: totalPagamentos }, categorias] = await Promise.all([
    getPagamentosAvulsos(ano, mes),
    getCategorias("categorias_avulsos"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Pagamentos avulsos</h1>
        <p className="text-muted-foreground text-sm">
          Recebimentos e taxas não vinculados a uma parcela de matrícula.
        </p>
      </div>
      <AvulsosView
        pagamentosIniciais={pagamentos}
        totalInicial={totalPagamentos}
        anoInicial={ano}
        mesInicial={mes}
        categorias={categorias}
      />
    </div>
  );
}
