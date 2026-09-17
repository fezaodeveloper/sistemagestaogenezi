import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAgendamentoPaginasAdmin } from "@/lib/agendamentos/agendamentos";
import { AgendamentosAdminView } from "@/components/admin/agendamentos-admin-view";

export default async function AgendamentosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const paginas = await getAgendamentoPaginasAdmin(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Agendamentos</h1>
        <p className="text-muted-foreground text-sm">
          Páginas públicas para leads marcarem visitas presenciais, sem precisar de login.
        </p>
      </div>

      <AgendamentosAdminView paginas={paginas} />
    </div>
  );
}
