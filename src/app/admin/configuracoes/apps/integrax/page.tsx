import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { chaveCriptografiaConfigurada } from "@/lib/gateways/crypto";
import { INTEGRAX_CONFIG_ID, carregarConfigSms } from "@/lib/integrax/config";
import { SMS_TEMPLATE_IDS, SMS_TEMPLATES } from "@/lib/integrax/templates";
import {
  RECUPERACAO_CONFIG_ID,
  RECUPERACAO_PRAZO_PADRAO_HORAS,
  horasParaDias,
  lerEtapas,
} from "@/lib/integrax/recuperacao";
import { IntegraxForm } from "@/components/admin/integrax-form";
import { IntegraxRecuperacao } from "@/components/admin/integrax-recuperacao";
import { IntegraxTemplates, type TemplateEdicao } from "@/components/admin/integrax-templates";

const ABAS = [
  { id: "configuracao", rotulo: "Configuração" },
  { id: "templates", rotulo: "Templates" },
  { id: "recuperacao", rotulo: "Recuperação Escalonada" },
] as const;
type AbaId = (typeof ABAS)[number]["id"];

function hrefAba(id: AbaId): string {
  return id === "configuracao" ? "/admin/configuracoes/apps/integrax" : `/admin/configuracoes/apps/integrax?aba=${id}`;
}

export default async function IntegraxPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireRole("admin");

  const { aba: abaParam } = await searchParams;
  const aba: AbaId = ABAS.some((a) => a.id === abaParam) ? (abaParam as AbaId) : "configuracao";

  const supabase = await createClient();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/configuracoes/apps" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          Apps
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">IntegraX SMS</h1>
          <p className="text-muted-foreground text-sm">Envio de SMS para alunos: boas-vindas, pagamentos e cobranças.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções do IntegraX">
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

      {aba === "configuracao" && <AbaConfiguracao supabase={supabase} />}
      {aba === "templates" && <AbaTemplates supabase={supabase} />}
      {aba === "recuperacao" && <AbaRecuperacao supabase={supabase} />}
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ----- Configuração (o que já existia, sem mudanças) -----

async function AbaConfiguracao({ supabase }: { supabase: Supabase }) {
  const { data, error } = await supabase
    .from("integracoes_sms_config")
    .select("token, ativo")
    .eq("id", INTEGRAX_CONFIG_ID)
    .maybeSingle();

  return (
    <>
      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler a configuração (a migration <code>integracoes_sms_config</code> já foi aplicada?).
        </p>
      )}

      {/* O token criptografado nunca sai do servidor: só o booleano "tem token". */}
      <IntegraxForm
        temToken={!!data?.token}
        ativoInicial={data?.ativo === true}
        criptografiaConfigurada={chaveCriptografiaConfigurada()}
      />
    </>
  );
}

// ----- Templates -----

async function AbaTemplates({ supabase }: { supabase: Supabase }) {
  const { data, error } = await supabase.from("sms_templates").select("id, mensagem, ativo");

  // O banco manda; o que faltar (linha ausente ou tabela ainda não criada) cai no padrão do código.
  const doBanco = new Map(((data ?? []) as { id: string; mensagem: string; ativo: boolean }[]).map((t) => [t.id, t]));
  const templates: TemplateEdicao[] = SMS_TEMPLATE_IDS.map((id) => {
    const salvo = doBanco.get(id);
    return { id, mensagem: salvo?.mensagem ?? SMS_TEMPLATES[id].padrao, ativo: salvo?.ativo ?? true };
  });

  return (
    <>
      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler os templates (a migration <code>sms_templates</code> já foi aplicada?). Enquanto isso, os SMS usam as
          mensagens padrão; salvar só funciona depois da migration.
        </p>
      )}
      <IntegraxTemplates templates={templates} />
    </>
  );
}

// ----- Recuperação escalonada -----

function seteDiasAtrasISO(): string {
  return new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
}

async function AbaRecuperacao({ supabase }: { supabase: Supabase }) {
  const seteDiasAtras = seteDiasAtrasISO();
  const [{ data, error }, { count, error: erroLog }, sms] = await Promise.all([
    supabase
      .from("sms_recuperacao_config")
      .select("ativo, prazo_maximo_horas, etapas")
      .eq("id", RECUPERACAO_CONFIG_ID)
      .maybeSingle(),
    supabase
      .from("sms_recuperacao_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "enviado")
      .gte("enviado_at", seteDiasAtras),
    carregarConfigSms(),
  ]);

  return (
    <>
      {(error || erroLog) && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler a recuperação (as migrations <code>sms_templates</code> e <code>sms_recuperacao_log</code> já foram
          aplicadas?). Salvar só funciona depois delas.
        </p>
      )}
      <IntegraxRecuperacao
        inicial={{
          ativo: data?.ativo === true,
          prazoDias: horasParaDias(Number(data?.prazo_maximo_horas) || RECUPERACAO_PRAZO_PADRAO_HORAS),
          etapas: lerEtapas(data?.etapas),
        }}
        integracaoAtiva={!!sms.token && sms.ativo}
        enviadosUltimos7Dias={erroLog ? null : (count ?? 0)}
      />
    </>
  );
}
