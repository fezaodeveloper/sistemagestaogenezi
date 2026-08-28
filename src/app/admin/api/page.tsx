import { requireRole } from "@/lib/auth/dal";
import { getApiKeys } from "@/app/admin/api/actions";
import { ApiKeysView } from "@/components/admin/api-keys-view";
import { ApiDocumentacao } from "@/components/admin/api-documentacao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ApiPage() {
  await requireRole("admin");

  const apiKeys = await getApiKeys();
  const apiKeyAtiva = apiKeys.find((apiKey) => apiKey.ativa)?.chave ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">API &amp; Integrações</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as chaves de API para integração com N8n e outros serviços.
        </p>
      </div>

      <Tabs defaultValue="chaves">
        <TabsList>
          <TabsTrigger value="chaves">Chaves de API</TabsTrigger>
          <TabsTrigger value="documentacao">Documentação</TabsTrigger>
        </TabsList>
        <TabsContent value="chaves">
          <ApiKeysView apiKeys={apiKeys} />
        </TabsContent>
        <TabsContent value="documentacao">
          <ApiDocumentacao apiKeyAtiva={apiKeyAtiva} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
