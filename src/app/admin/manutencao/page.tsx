import { requireRole } from "@/lib/auth/dal";
import { getManutencaoChamados } from "@/app/admin/manutencao/actions";
import { ManutencaoView } from "@/components/admin/manutencao-view";

export default async function ManutencaoPage() {
  await requireRole("admin");

  const chamados = await getManutencaoChamados();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Manutenção</h1>
        <p className="text-muted-foreground text-sm">Chamados internos de manutenção e infraestrutura.</p>
      </div>
      <ManutencaoView chamados={chamados} />
    </div>
  );
}
