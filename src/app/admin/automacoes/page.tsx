import { requireRole } from "@/lib/auth/dal";
import { getEventosAutomacao } from "@/app/admin/automacoes/actions";
import { AutomacoesLogView } from "@/components/admin/automacoes-log-view";
import { AutomacoesAuditoriaView } from "@/components/admin/automacoes-auditoria-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AutomacoesPage() {
  await requireRole("admin");

  const { eventos, total } = await getEventosAutomacao({});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Automações</h1>
        <p className="text-muted-foreground text-sm">
          Log dos eventos processados pelo motor de automações e auditoria de notificações por WhatsApp.
        </p>
      </div>

      <Tabs defaultValue="eventos">
        <TabsList>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="eventos">
          <p className="text-muted-foreground mb-3 text-sm">{total} evento(s) no total.</p>
          <AutomacoesLogView eventosIniciais={eventos} totalInicial={total} />
        </TabsContent>

        <TabsContent value="auditoria">
          <AutomacoesAuditoriaView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
