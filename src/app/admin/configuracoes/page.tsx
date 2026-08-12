import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracoesForm } from "@/components/admin/configuracoes-form";
import { CriteriosCertificadoForm } from "@/components/admin/criterios-certificado-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConfiguracoesPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracoes")
    .select(
      "ead_participa_gamificacao, certificado_nota_minima_percentual, certificado_frequencia_minima_percentual",
    )
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
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Certificados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CriteriosCertificadoForm
            notaMinimaInicial={data?.certificado_nota_minima_percentual ?? 75}
            frequenciaMinimaInicial={data?.certificado_frequencia_minima_percentual ?? 75}
          />
          <Button
            render={<Link href="/admin/certificados/template" />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="w-fit"
          >
            Editar template do certificado
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
