import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAgendamentoPaginasAdmin } from "@/lib/agendamentos/agendamentos";
import { getCampanhasPaginasAtivas, getResponsaveisAdmin } from "@/app/admin/comercial/agendamentos/actions";
import { AgendamentosAdminView } from "@/components/admin/agendamentos-admin-view";

export default async function AgendamentosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [paginas, responsaveis, campanhas, { data: config }] = await Promise.all([
    getAgendamentoPaginasAdmin(supabase),
    getResponsaveisAdmin(),
    getCampanhasPaginasAtivas(),
    supabase.from("configuracoes").select("escola_logo_url").eq("id", true).maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Agendamentos</h1>
        <p className="text-muted-foreground text-sm">
          Páginas públicas para leads marcarem visitas presenciais, sem precisar de login.
        </p>
      </div>

      <AgendamentosAdminView
        paginas={paginas}
        responsaveis={responsaveis}
        campanhas={campanhas}
        escolaLogoUrl={config?.escola_logo_url ?? null}
      />
    </div>
  );
}
