import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getChaveEvolutionConfigurada, isWhatsappStatus } from "@/lib/whatsapp/config";
import { WHATSAPP_TEMPLATE_IDS, WHATSAPP_TEMPLATES, isWhatsappTemplateId } from "@/lib/whatsapp/templates";
import { WhatsappAntibanimentoForm } from "@/components/admin/whatsapp-antibanimento-form";
import { WhatsappConexaoForm } from "@/components/admin/whatsapp-conexao-form";
import { WhatsappStatusCard } from "@/components/admin/whatsapp-status-card";
import { WhatsappTemplatesLista, type TemplateEdicao } from "@/components/admin/whatsapp-templates";
import { WhatsappTesteForm } from "@/components/admin/whatsapp-teste-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ABAS = [
  { id: "conexao", rotulo: "Conexão" },
  { id: "templates", rotulo: "Templates" },
] as const;
type AbaId = (typeof ABAS)[number]["id"];

function hrefAba(id: AbaId): string {
  return id === "conexao" ? "/admin/configuracoes/whatsapp" : `/admin/configuracoes/whatsapp?aba=${id}`;
}

export default async function WhatsappPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireRole("admin");

  const { aba: abaParam } = await searchParams;
  const aba: AbaId = ABAS.some((a) => a.id === abaParam) ? (abaParam as AbaId) : "conexao";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">GênZap — WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Conexão com o WhatsApp via Evolution API, número pareado e mensagens automáticas.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções do WhatsApp">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={hrefAba(a.id)}
            role="tab"
            aria-selected={a.id === aba}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              a.id === aba ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent/50"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </div>

      {aba === "conexao" ? <AbaConexao /> : <AbaTemplates />}
    </div>
  );
}

async function AbaConexao() {
  const supabase = await createClient();
  const [{ data, error }, chaveConfigurada] = await Promise.all([
    supabase
      .from("whatsapp_config")
      .select("evolution_api_url, evolution_instance_name, ativo, status, numero_conectado, delay_min_segundos, delay_max_segundos")
      .eq("id", true)
      .maybeSingle(),
    getChaveEvolutionConfigurada(),
  ]);

  const url = data?.evolution_api_url ?? "";
  const instancia = data?.evolution_instance_name ?? "genezi";
  const ativo = data?.ativo === true;
  const status = isWhatsappStatus(data?.status) ? data.status : "desconectado";
  const conexaoConfigurada = !!url && !!instancia && chaveConfigurada;

  return (
    <>
      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler a configuração (a migration <code>whatsapp_genzap</code> já foi aplicada?).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conexão</CardTitle>
          <CardDescription>Dados da sua instância da Evolution API, instalada na sua VPS.</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsappConexaoForm urlInicial={url} instanciaInicial={instancia} chaveConfigurada={chaveConfigurada} ativoInicial={ativo} />
        </CardContent>
      </Card>

      <WhatsappStatusCard statusInicial={status} numeroConectadoInicial={data?.numero_conectado ?? null} conexaoConfigurada={conexaoConfigurada} />

      <Card>
        <CardHeader>
          <CardTitle>Anti-banimento</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsappAntibanimentoForm minInicial={data?.delay_min_segundos ?? 3} maxInicial={data?.delay_max_segundos ?? 8} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste de envio</CardTitle>
          <CardDescription>Envia direto pela Evolution API, mesmo com o envio automático desligado — só exige estar conectado.</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsappTesteForm />
        </CardContent>
      </Card>
    </>
  );
}

async function AbaTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_templates").select("id, mensagem, ativo");

  if (error) {
    return (
      <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        Não foi possível ler os templates (a migration <code>whatsapp_templates</code> já foi aplicada?).
      </p>
    );
  }

  // O banco manda; qualquer id que falte (linha ausente) cai no padrão do código.
  const doBanco = new Map(
    ((data ?? []) as { id: string; mensagem: string; ativo: boolean }[])
      .filter((t) => isWhatsappTemplateId(t.id))
      .map((t) => [t.id, t]),
  );
  const templates: TemplateEdicao[] = WHATSAPP_TEMPLATE_IDS.map((id) => {
    const salvo = doBanco.get(id);
    return { id, mensagem: salvo?.mensagem ?? WHATSAPP_TEMPLATES[id].padrao, ativo: salvo?.ativo ?? true };
  });

  return <WhatsappTemplatesLista templates={templates} />;
}
