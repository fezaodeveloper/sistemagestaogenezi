import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { chaveCriptografiaConfigurada } from "@/lib/gateways/crypto";
import { isProvedorEmail } from "@/lib/email/config";
import { EMAIL_TEMPLATE_IDS, TEMPLATES_PADRAO } from "@/lib/email/templates-padrao";
import { EmailProvedores, type DadosProvedores } from "@/components/admin/email-provedores";
import { EmailTemplates, type TemplateItem } from "@/components/admin/email-templates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LinhaConfig = {
  provedor: string;
  resend_api_key: string | null;
  resend_from_name: string | null;
  resend_from_email: string | null;
  smtp_host: string | null;
  smtp_porta: number | null;
  smtp_usuario: string | null;
  smtp_senha: string | null;
  smtp_ssl: boolean | null;
  smtp_from_name: string | null;
  smtp_from_email: string | null;
  sendgrid_api_key: string | null;
  sendgrid_from_name: string | null;
  sendgrid_from_email: string | null;
};

type LinhaTemplate = { id: string; nome: string; assunto: string; corpo_html: string; variaveis: string[] | null; ativo: boolean };

export default async function EmailPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data: configData, error: erroConfig }, { data: templatesData, error: erroTemplates }] = await Promise.all([
    supabase.from("email_config").select("*").maybeSingle(),
    supabase.from("email_templates").select("id, nome, assunto, corpo_html, variaveis, ativo"),
  ]);

  const c = (configData ?? null) as LinhaConfig | null;
  // Segredos NUNCA seguem pra tela: só o booleano "tem valor salvo".
  const dados: DadosProvedores = {
    emUso: c && isProvedorEmail(c.provedor) ? c.provedor : "resend",
    criptografiaConfigurada: chaveCriptografiaConfigurada(),
    resend: {
      temChave: !!c?.resend_api_key,
      chaveNoAmbiente: !!process.env.RESEND_API_KEY,
      fromName: c?.resend_from_name ?? "",
      fromEmail: c?.resend_from_email ?? "",
    },
    smtp: {
      host: c?.smtp_host ?? "",
      porta: c?.smtp_porta ?? 587,
      usuario: c?.smtp_usuario ?? "",
      temSenha: !!c?.smtp_senha,
      ssl: c?.smtp_ssl ?? true,
      fromName: c?.smtp_from_name ?? "",
      fromEmail: c?.smtp_from_email ?? "",
    },
    sendgrid: {
      temChave: !!c?.sendgrid_api_key,
      fromName: c?.sendgrid_from_name ?? "",
      fromEmail: c?.sendgrid_from_email ?? "",
    },
  };

  // Um item por tipo de e-mail: o salvo no banco ou, se ainda não houver, o padrão.
  const salvos = new Map(((templatesData ?? []) as LinhaTemplate[]).map((linha) => [linha.id, linha]));
  const templates: TemplateItem[] = EMAIL_TEMPLATE_IDS.map((id) => {
    const padrao = TEMPLATES_PADRAO[id];
    const salvo = salvos.get(id);
    return {
      id,
      nome: padrao.nome,
      descricao: padrao.descricao,
      assunto: salvo?.assunto ?? padrao.assunto,
      corpo_html: salvo?.corpo_html ?? padrao.corpo_html,
      variaveis: padrao.variaveis,
      ativo: salvo?.ativo ?? true,
      exemplo: padrao.exemplo,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">E-mail</h1>
        <p className="text-muted-foreground text-sm">
          Escolha o provedor que envia os e-mails do sistema e personalize o texto de cada e-mail.
        </p>
      </div>

      {(erroConfig || erroTemplates) && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler {erroConfig ? <code>email_config</code> : <code>email_templates</code>} (a migration já foi aplicada?).
          Enquanto isso, os e-mails continuam saindo pelo Resend do ambiente, com os textos padrão.
        </p>
      )}

      <Tabs defaultValue="provedor">
        <TabsList>
          <TabsTrigger value="provedor">Provedor</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="provedor">
          <EmailProvedores dados={dados} />
        </TabsContent>
        <TabsContent value="templates">
          <EmailTemplates templates={templates} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
