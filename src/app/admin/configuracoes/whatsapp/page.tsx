import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getChaveEvolutionConfigurada, isWhatsappStatus } from "@/lib/whatsapp/config";
import { WhatsappAntibanimentoForm } from "@/components/admin/whatsapp-antibanimento-form";
import { WhatsappConexaoForm } from "@/components/admin/whatsapp-conexao-form";
import { WhatsappStatusCard } from "@/components/admin/whatsapp-status-card";
import { WhatsappTesteForm } from "@/components/admin/whatsapp-teste-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WhatsappPage() {
  await requireRole("admin");

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">GênZap — WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Conexão com o WhatsApp via Evolution API, número pareado e envio automático.</p>
      </div>

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

      <p className="text-muted-foreground text-xs">
        Os modelos de mensagem automática (matrícula, lembrete de aula, falta, recontato de lead) continuam em{" "}
        <Link href="/admin/mensagens/configuracao" className="underline underline-offset-2">
          Mensagens &gt; Configuração
        </Link>
        .
      </p>
    </div>
  );
}
