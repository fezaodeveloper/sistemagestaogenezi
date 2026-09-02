"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  contratoTemplateFormSchema,
  extrairTextoPlano,
  CONTRATO_TIPO_CURSO_LABELS,
  type ContratoTemplate,
  type ContratoTipoCurso,
} from "@/lib/contratos/schema";

export async function getContratoTemplates(): Promise<ContratoTemplate[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("contrato_template").select("*").order("tipo_curso");

  return (data as ContratoTemplate[] | null) ?? [];
}

export type ContratoTemplateFormState =
  | {
      errors?: Partial<Record<"conteudo" | "cor_texto", string[]>>;
      error?: string;
      salvo?: boolean;
    }
  | undefined;

// templateId + tipoCurso vêm presos via .bind() na própria page.tsx (mesmo
// padrão de updateCertificadoTemplate) — templateId só é null se, por
// algum motivo raro, a criação do template padrão daquele tipo na
// page.tsx tiver falhado antes de renderizar o form; nesse caso o insert
// abaixo (já com o tipo_curso certo) cobre o caso.
export async function salvarContratoTemplate(
  templateId: string | null,
  tipoCurso: ContratoTipoCurso,
  _prevState: ContratoTemplateFormState,
  formData: FormData,
): Promise<ContratoTemplateFormState> {
  const user = await requireRole("admin");

  const parsed = contratoTemplateFormSchema.safeParse({
    cor_texto: formData.get("cor_texto"),
    conteudo: formData.get("conteudo"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const conteudoTexto = extrairTextoPlano(parsed.data.conteudo);

  const { error } = templateId
    ? await supabase
        .from("contrato_template")
        .update({
          conteudo: parsed.data.conteudo,
          conteudo_texto: conteudoTexto,
          cor_texto: parsed.data.cor_texto,
          updated_by: user.id,
        })
        .eq("id", templateId)
    : await supabase.from("contrato_template").insert({
        tipo_curso: tipoCurso,
        nome: `Contrato ${CONTRATO_TIPO_CURSO_LABELS[tipoCurso]}`,
        conteudo: parsed.data.conteudo,
        conteudo_texto: conteudoTexto,
        cor_texto: parsed.data.cor_texto,
        created_by: user.id,
      });

  if (error) {
    return { error: "Não foi possível salvar o template. Tente novamente." };
  }

  revalidatePath("/admin/contrato");
  return { salvo: true };
}
