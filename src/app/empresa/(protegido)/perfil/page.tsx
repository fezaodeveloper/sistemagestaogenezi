import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaPorProfileId } from "@/lib/conecta/empresas";
import { EditarPerfilEmpresaForm } from "@/components/empresa/editar-perfil-empresa-form";
import { TrocarSenhaEmpresaForm } from "@/components/empresa/trocar-senha-empresa-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <EditarPerfilEmpresaForm empresa={empresa} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <TrocarSenhaEmpresaForm />
        </CardContent>
      </Card>
    </div>
  );
}
