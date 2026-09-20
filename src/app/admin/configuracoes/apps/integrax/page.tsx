import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { chaveCriptografiaConfigurada } from "@/lib/gateways/crypto";
import { INTEGRAX_CONFIG_ID } from "@/lib/integrax/config";
import { IntegraxForm } from "@/components/admin/integrax-form";

export default async function IntegraxPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integracoes_sms_config")
    .select("token, ativo")
    .eq("id", INTEGRAX_CONFIG_ID)
    .maybeSingle();

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
    </div>
  );
}
