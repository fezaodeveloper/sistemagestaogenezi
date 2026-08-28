import { requireRole } from "@/lib/auth/dal";
import { getEstoqueItens } from "@/app/admin/estoque/actions";
import { EstoqueView } from "@/components/admin/estoque-view";

export default async function EstoquePage() {
  await requireRole("admin");

  const itens = await getEstoqueItens();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Estoque</h1>
        <p className="text-muted-foreground text-sm">
          Controle de materiais, apostilas, fardas e kits.
        </p>
      </div>
      <EstoqueView itens={itens} />
    </div>
  );
}
