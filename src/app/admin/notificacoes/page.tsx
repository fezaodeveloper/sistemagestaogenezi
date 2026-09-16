import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NotificacoesAdminView } from "@/components/admin/notificacoes-admin-view";

export default async function NotificacoesAdminPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .not("aluno_id", "is", null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Enviar notificação</h1>
        <p className="text-muted-foreground text-sm">
          Envie uma notificação push para os alunos com notificações ativadas no navegador ou no app instalado.
        </p>
      </div>
      <NotificacoesAdminView totalDispositivos={count ?? 0} />
    </div>
  );
}
