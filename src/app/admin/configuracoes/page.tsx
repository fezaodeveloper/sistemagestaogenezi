import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getBannersLoginAdmin } from "@/app/admin/configuracoes/actions";
import { AssinaturaDiretorForm } from "@/components/admin/assinatura-diretor-form";
import { ConfiguracoesForm } from "@/components/admin/configuracoes-form";
import { CriteriosCertificadoForm } from "@/components/admin/criterios-certificado-form";
import { DadosEscolaForm } from "@/components/admin/dados-escola-form";
import { ConfiguracoesNotificacoesForm } from "@/components/admin/configuracoes-notificacoes-form";
import { BannersLoginForm } from "@/components/admin/banners-login-form";
import { LogoEscolaForm } from "@/components/admin/logo-escola-form";
import { RodapeLoginForm } from "@/components/admin/rodape-login-form";
import { BackupSection } from "@/components/admin/backup-section";
import { LogSistemaView } from "@/components/admin/log-sistema-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ConfiguracoesPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data }, banners] = await Promise.all([
    supabase
      .from("configuracoes")
      .select(
        "ead_participa_gamificacao, certificado_nota_minima_percentual, certificado_frequencia_minima_percentual, escola_nome, escola_cnpj, escola_telefone, escola_email, escola_endereco, escola_cidade, escola_estado, escola_cep, escola_site, escola_logo_url, escola_logo_path, assinatura_admin_url, assinatura_admin_path, nome_diretor, notif_financeiro_atrasado, notif_certificados_pendentes, notif_eventos_hoje, notif_eventos_amanha, login_rodape",
      )
      .single(),
    getBannersLoginAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Configurações gerais da plataforma.</p>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="banners">Banners do Login</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="log">Log do sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="flex flex-col gap-6">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Logomarca da Escola</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoEscolaForm
                defaultValues={{
                  escola_logo_url: data?.escola_logo_url ?? null,
                  escola_logo_path: data?.escola_logo_path ?? null,
                }}
              />
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Assinatura do Diretor</CardTitle>
            </CardHeader>
            <CardContent>
              <AssinaturaDiretorForm
                defaultValues={{
                  assinatura_admin_url: data?.assinatura_admin_url ?? null,
                  assinatura_admin_path: data?.assinatura_admin_path ?? null,
                  nome_diretor: data?.nome_diretor ?? null,
                }}
              />
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Dados da escola</CardTitle>
            </CardHeader>
            <CardContent>
              <DadosEscolaForm
                defaultValues={{
                  escola_nome: data?.escola_nome ?? "GÊNEZI Educação Profissional",
                  escola_cnpj: data?.escola_cnpj ?? null,
                  escola_telefone: data?.escola_telefone ?? null,
                  escola_email: data?.escola_email ?? null,
                  escola_endereco: data?.escola_endereco ?? null,
                  escola_cidade: data?.escola_cidade ?? null,
                  escola_estado: data?.escola_estado ?? null,
                  escola_cep: data?.escola_cep ?? null,
                  escola_site: data?.escola_site ?? null,
                }}
              />
            </CardContent>
          </Card>

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
        </TabsContent>

        <TabsContent value="notificacoes">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfiguracoesNotificacoesForm
                defaultValues={{
                  notif_financeiro_atrasado: data?.notif_financeiro_atrasado ?? true,
                  notif_certificados_pendentes: data?.notif_certificados_pendentes ?? true,
                  notif_eventos_hoje: data?.notif_eventos_hoje ?? true,
                  notif_eventos_amanha: data?.notif_eventos_amanha ?? true,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banners" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Rodapé da tela de login</CardTitle>
            </CardHeader>
            <CardContent>
              <RodapeLoginForm rodapeInicial={data?.login_rodape ?? null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banners do Login</CardTitle>
            </CardHeader>
            <CardContent>
              <BannersLoginForm banners={banners} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <BackupSection />
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle>Log do sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <LogSistemaView />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
