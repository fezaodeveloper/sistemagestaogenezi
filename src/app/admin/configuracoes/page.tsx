import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracoesForm } from "@/components/admin/configuracoes-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConfiguracoesPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracoes")
    .select("ead_participa_gamificacao")
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Configurações gerais da plataforma.</p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Gamificação</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfiguracoesForm eadParticipaInicial={data?.ead_participa_gamificacao ?? true} />
        </CardContent>
      </Card>
    </div>
  );
}
