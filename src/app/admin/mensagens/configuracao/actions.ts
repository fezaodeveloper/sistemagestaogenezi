"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappConfigFormSchema } from "@/lib/mensagens/schema";

type ConfigFormValuesEcho = {
  evolution_api_url: string;
  evolution_instance_name: string;
  ativo: boolean;
  template_matricula_criada: string;
  template_lembrete_aula: string;
  template_falta: string;
  template_lead_recontato: string;
};

export type WhatsappConfigFormState =
  | {
      errors?: Partial<
        Record<
          | "evolution_api_url"
          | "evolution_instance_name"
          | "template_matricula_criada"
          | "template_lembrete_aula"
          | "template_falta"
          | "template_lead_recontato",
          string[]
        >
      >;
      error?: string;
      success?: boolean;
      values?: ConfigFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): ConfigFormValuesEcho {
  return {
    evolution_api_url: String(formData.get("evolution_api_url") ?? ""),
    evolution_instance_name: String(formData.get("evolution_instance_name") ?? ""),
    ativo: formData.get("ativo") === "on",
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
    evolution_api_url: formData.get("evolution_api_url") || undefined,
    evolution_instance_name: formData.get("evolution_instance_name") || undefined,
    evolution_api_key: formData.get("evolution_api_key") || undefined,
    ativo: formData.get("ativo") === "on",
    template_matricula_criada: formData.get("template_matricula_criada"),
    template_lembrete_aula: formData.get("template_lembrete_aula"),
    template_falta: formData.get("template_falta"),
    template_lead_recontato: formData.get("template_lead_recontato"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  // evolution_api_key não tem grant de select pra authenticated (a tela
  // nunca lê o valor salvo de volta) — client admin exclusivamente pra
  // essa gravação, o client normal nem conseguiria fazer update do campo
  // sem estourar o restante do payload (na verdade tem grant de update,
  // mas mantemos tudo pelo client admin por consistência e porque o
  // "campo vazio = não mexe" abaixo precisa ler o valor atual, que também
  // só o admin consegue).
  const admin = createAdminClient();

  const update: Record<string, unknown> = {
    evolution_api_url: parsed.data.evolution_api_url ?? null,
    evolution_instance_name: parsed.data.evolution_instance_name ?? null,
    ativo: parsed.data.ativo,
    template_matricula_criada: parsed.data.template_matricula_criada,
    template_lembrete_aula: parsed.data.template_lembrete_aula,
    template_falta: parsed.data.template_falta,
    template_lead_recontato: parsed.data.template_lead_recontato,
    updated_by: user.id,
  };
  // Campo vazio = "não alterar a chave atual" (a tela nunca mostra o valor
  // salvo, então digitar algo é a única forma de trocar; deixar em branco
  // não pode apagar a chave sem querer).
  if (parsed.data.evolution_api_key) {
    update.evolution_api_key = parsed.data.evolution_api_key;
  }

  const { error } = await admin.from("whatsapp_config").update(update).eq("id", true);

  if (error) {
    return { error: "Não foi possível salvar a configuração. Tente novamente.", values: echoValues(formData) };
  }

  revalidatePath("/admin/mensagens/configuracao");
  return { success: true, values: echoValues(formData) };
}
