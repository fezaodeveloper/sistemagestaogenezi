import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaPorProfileId } from "@/lib/conecta/empresas";
import { EMPRESA_STATUS_LABELS } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{valor && valor.length > 0 ? valor : "—"}</span>
    </div>
  );
}

// Etapa 1 (base de dados + autenticação) — exibição somente leitura; edição
// do próprio perfil fica pra uma próxima etapa.
export default async function EmpresaPerfilPage() {
  const user = await requireEmpresa();
  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);

  if (!empresa) {
    return (
      <Card>
        <CardContent className="text-destructive py-10 text-center text-sm">
          Não foi possível carregar os dados da sua empresa.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="text-muted-foreground text-sm">Dados cadastrais da sua empresa.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{empresa.nome_empresa}</CardTitle>
          <Badge variant="outline">{EMPRESA_STATUS_LABELS[empresa.status]}</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="CNPJ" valor={empresa.cnpj} />
          <Campo label="Setor" valor={empresa.setor} />
          <Campo label="Nome do responsável" valor={empresa.nome_responsavel} />
          <Campo label="E-mail" valor={empresa.email} />
          <Campo label="WhatsApp" valor={empresa.whatsapp} />
          <Campo label="Telefone" valor={empresa.telefone} />
          <Campo label="Site" valor={empresa.site} />
          <Campo
            label="Cidade/Estado"
            valor={empresa.cidade || empresa.estado ? `${empresa.cidade ?? "—"}/${empresa.estado ?? "—"}` : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
