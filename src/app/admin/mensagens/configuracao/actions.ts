"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappConfigFormSchema } from "@/lib/mensagens/schema";

// URL/instância/chave/ativo (conexão com a Evolution API) saíram deste formulário — ver
// Configurações > WhatsApp (GênZap). Esta action só grava os 4 modelos de mensagem.

type ConfigFormValuesEcho = {
  template_matricula_criada: string;
  template_lembrete_aula: string;
  template_falta: string;
  template_lead_recontato: string;
};

export type WhatsappConfigFormState =
  | {
      errors?: Partial<
        Record<"template_matricula_criada" | "template_lembrete_aula" | "template_falta" | "template_lead_recontato", string[]>
      >;
      error?: string;
      success?: boolean;
      values?: ConfigFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): ConfigFormValuesEcho {
  return {
    template_matricula_criada: String(formData.get("template_matricula_criada") ?? ""),
    template_lembrete_aula: String(formData.get("template_lembrete_aula") ?? ""),
    template_falta: String(formData.get("template_falta") ?? ""),
    template_lead_recontato: String(formData.get("template_lead_recontato") ?? ""),
  };
}

export async function updateWhatsappConfig(
  _prevState: WhatsappConfigFormState,
  formData: FormData,
): Promise<WhatsappConfigFormState> {
  const user = await requireRole("admin");

  const parsed = whatsappConfigFormSchema.safeParse({
    template_matricula_criada: formData.get("template_matricula_criada"),
    template_lembrete_aula: formData.get("template_lembrete_aula"),
    template_falta: formData.get("template_falta"),
    template_lead_recontato: formData.get("template_lead_recontato"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  // Client admin por consistência com o resto do arquivo (a leitura de evolution_api_key em
  // outros pontos também exige service_role) — o update em si não toca nessa coluna.
  const admin = createAdminClient();

  const { error } = await admin
    .from("whatsapp_config")
    .update({
      template_matricula_criada: parsed.data.template_matricula_criada,
      template_lembrete_aula: parsed.data.template_lembrete_aula,
      template_falta: parsed.data.template_falta,
      template_lead_recontato: parsed.data.template_lead_recontato,
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar a configuração. Tente novamente.", values: echoValues(formData) };
  }

  revalidatePath("/admin/mensagens/configuracao");
  return { success: true, values: echoValues(formData) };
}
