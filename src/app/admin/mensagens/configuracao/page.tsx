import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { WhatsappConfigForm } from "@/components/admin/whatsapp-config-form";
import { getChaveEvolutionConfigurada } from "@/lib/mensagens/mensagens";
import { updateWhatsappConfig } from "./actions";
import type { WhatsappConfig } from "@/lib/mensagens/schema";

export default async function WhatsappConfiguracaoPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data }, chaveConfigurada] = await Promise.all([
    supabase
      .from("whatsapp_config")
      .select(
        "evolution_api_url, evolution_instance_name, ativo, template_matricula_criada, template_lembrete_aula, template_falta",
      )
      .eq("id", true)
      .single(),
    getChaveEvolutionConfigurada(),
  ]);
  const config = data as Omit<WhatsappConfig, "id" | "updated_by" | "updated_at"> | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuração do WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Conexão com a Evolution API e os modelos das 3 mensagens automáticas.
        </p>
      </div>
      <WhatsappConfigForm
        action={updateWhatsappConfig}
        defaultValues={{
          evolution_api_url: config?.evolution_api_url ?? "",
          evolution_instance_name: config?.evolution_instance_name ?? "",
          ativo: config?.ativo ?? false,
          template_matricula_criada: config?.template_matricula_criada ?? "",
          template_lembrete_aula: config?.template_lembrete_aula ?? "",
          template_falta: config?.template_falta ?? "",
        }}
        chaveConfigurada={chaveConfigurada}
      />
    </div>
  );
}
