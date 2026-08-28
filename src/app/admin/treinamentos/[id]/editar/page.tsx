import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getTreinamento, updateTreinamento } from "@/app/admin/treinamentos/actions";
import { TreinamentoForm } from "@/components/admin/treinamento-form";

export default async function EditarTreinamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const treinamento = await getTreinamento(id);
  if (!treinamento) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar treinamento</h1>
        <p className="text-muted-foreground text-sm">{treinamento.titulo}</p>
      </div>
      <TreinamentoForm
        action={updateTreinamento.bind(null, id)}
        submitLabel="Salvar alterações"
        defaultValues={{
          titulo: treinamento.titulo,
          descricao: treinamento.descricao ?? "",
          categoria: treinamento.categoria,
          youtube_url: treinamento.youtube_url,
          status: treinamento.status,
          ordem: treinamento.ordem,
        }}
      />
    </div>
  );
}
