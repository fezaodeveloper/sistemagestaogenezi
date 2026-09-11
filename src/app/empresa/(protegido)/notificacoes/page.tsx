import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaPorProfileId, getNotificacoesDaEmpresa } from "@/lib/conecta/empresas";
import { NotificacaoItem } from "@/components/empresa/notificacao-item";
import { Card, CardContent } from "@/components/ui/card";

export default async function EmpresaNotificacoesPage() {
  const user = await requireEmpresa();
  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  const notificacoes = empresa ? await getNotificacoesDaEmpresa(supabase, empresa.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <p className="text-muted-foreground text-sm">Avisos enviados pela administração da GÊNEZI.</p>
      </div>

      {notificacoes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma notificação por enquanto.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notificacoes.map((notificacao) => (
            <NotificacaoItem key={notificacao.id} notificacao={notificacao} />
          ))}
        </div>
      )}
    </div>
  );
}
