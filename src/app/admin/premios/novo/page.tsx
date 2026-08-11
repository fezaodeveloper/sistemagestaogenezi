import { requireRole } from "@/lib/auth/dal";
import { PremioForm } from "@/components/admin/premio-form";
import { createPremio } from "@/app/admin/premios/actions";

export default async function NovoPremioPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo prêmio</h1>
        <p className="text-muted-foreground text-sm">Cadastre um item físico resgatável.</p>
      </div>
      <PremioForm action={createPremio} submitLabel="Criar prêmio" defaultValues={{ ativo: true }} />
    </div>
  );
}
