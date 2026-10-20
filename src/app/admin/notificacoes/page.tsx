import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NotificacoesAdminView } from "@/components/admin/notificacoes-admin-view";
import { PushTemplatesSection } from "@/components/admin/push-templates-section";
import { PushAgendamentosSection } from "@/components/admin/push-agendamentos-section";
import { listarAgendamentos, listarTemplates, listarTurmasAtivas } from "./actions";

export default async function NotificacoesAdminPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ count }, templates, agendamentos, turmas] = await Promise.all([
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).not("aluno_id", "is", null),
    listarTemplates(),
    listarAgendamentos(),
    listarTurmasAtivas(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Enviar notificação</h1>
        <p className="text-muted-foreground text-sm">
          Envie uma notificação push para os alunos com notificações ativadas no navegador ou no app instalado.
        </p>
      </div>
      <NotificacoesAdminView totalDispositivos={count ?? 0} />

      <div>
        <h2 className="text-xl font-semibold">Templates</h2>
      </div>
      <PushTemplatesSection templatesIniciais={templates} />

      <div>
        <h2 className="text-xl font-semibold">Agendamentos</h2>
      </div>
      <PushAgendamentosSection agendamentosIniciais={agendamentos} templates={templates} turmas={turmas} />
    </div>
  );
}
