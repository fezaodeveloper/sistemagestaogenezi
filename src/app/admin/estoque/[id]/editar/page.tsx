import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getEstoqueItem, updateEstoqueItem } from "@/app/admin/estoque/actions";
import { EstoqueItemForm } from "@/components/admin/estoque-item-form";

export default async function EditarEstoqueItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const item = await getEstoqueItem(id);
  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar item</h1>
        <p className="text-muted-foreground text-sm">{item.nome}</p>
      </div>
      <EstoqueItemForm
        action={updateEstoqueItem.bind(null, id)}
        submitLabel="Salvar alterações"
        defaultValues={{
          nome: item.nome,
          categoria: item.categoria,
          quantidade_atual: item.quantidade_atual,
          quantidade_minima: item.quantidade_minima,
          unidade: item.unidade,
          observacoes: item.observacoes ?? "",
        }}
      />
    </div>
  );
}
