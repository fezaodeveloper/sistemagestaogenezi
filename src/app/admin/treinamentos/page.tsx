import { requireRole } from "@/lib/auth/dal";
import { getTreinamentos } from "@/app/admin/treinamentos/actions";
import { TreinamentosView } from "@/components/admin/treinamentos-view";

export default async function TreinamentosPage() {
  await requireRole("admin");

  const treinamentos = await getTreinamentos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Treinamentos</h1>
        <p className="text-muted-foreground text-sm">Vídeos de treinamento para a equipe.</p>
      </div>
      <TreinamentosView treinamentos={treinamentos} />
    </div>
  );
}
