import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { WhatsappConfigForm } from "@/components/admin/whatsapp-config-form";
import { updateWhatsappConfig } from "./actions";

export default async function WhatsappConfiguracaoPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("whatsapp_config")
    .select("template_matricula_criada, template_lembrete_aula, template_falta, template_lead_recontato")
    .eq("id", true)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuração do WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Modelos das mensagens automáticas enviadas por WhatsApp.</p>
      </div>

      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
        A conexão com a Evolution API (URL, instância, chave, status e o interruptor de envio automático) agora fica em{" "}
        <Link href="/admin/configuracoes/whatsapp" className="text-foreground underline underline-offset-2">
          Configurações &gt; WhatsApp
        </Link>
        .
      </p>

      <WhatsappConfigForm
        action={updateWhatsappConfig}
        defaultValues={{
          template_matricula_criada: data?.template_matricula_criada ?? "",
          template_lembrete_aula: data?.template_lembrete_aula ?? "",
          template_falta: data?.template_falta ?? "",
          template_lead_recontato: data?.template_lead_recontato ?? "",
        }}
      />
    </div>
  );
}
