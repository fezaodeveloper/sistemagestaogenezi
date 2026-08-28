import { requireRole } from "@/lib/auth/dal";
import { createTreinamento } from "@/app/admin/treinamentos/actions";
import { TreinamentoForm } from "@/components/admin/treinamento-form";

export default async function NovoTreinamentoPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo treinamento</h1>
        <p className="text-muted-foreground text-sm">Cadastre um novo vídeo de treinamento.</p>
      </div>
      <TreinamentoForm action={createTreinamento} submitLabel="Salvar" />
    </div>
  );
}
