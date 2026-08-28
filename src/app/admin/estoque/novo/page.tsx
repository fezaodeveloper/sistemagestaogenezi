import { requireRole } from "@/lib/auth/dal";
import { createEstoqueItem } from "@/app/admin/estoque/actions";
import { EstoqueItemForm } from "@/components/admin/estoque-item-form";

export default async function NovoEstoqueItemPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo item</h1>
        <p className="text-muted-foreground text-sm">Cadastre um novo item de estoque.</p>
      </div>
      <EstoqueItemForm action={createEstoqueItem} submitLabel="Salvar" />
    </div>
  );
}
