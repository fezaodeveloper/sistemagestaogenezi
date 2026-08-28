import { requireRole } from "@/lib/auth/dal";
import { getEventosAutomacao } from "@/app/admin/automacoes/actions";
import { AutomacoesLogView } from "@/components/admin/automacoes-log-view";

export default async function AutomacoesPage() {
  await requireRole("admin");

  const eventos = await getEventosAutomacao();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Automações</h1>
        <p className="text-muted-foreground text-sm">
          Log dos últimos {eventos.length} eventos processados pelo motor de automações.
        </p>
      </div>
      <AutomacoesLogView eventos={eventos} />
    </div>
  );
}
