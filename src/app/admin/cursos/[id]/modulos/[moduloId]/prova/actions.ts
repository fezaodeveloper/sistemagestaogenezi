"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { provaFormSchema } from "@/lib/provas/schema";

type ProvaFormValuesEcho = {
  titulo: string;
  nota_minima_ativa: boolean;
  nota_minima_percentual: string;
  tentativas_limitadas: boolean;
  tentativas_maximas: string;
};

export type ProvaFormState =
  | {
      errors?: Partial<
        Record<"titulo" | "nota_minima_percentual" | "tentativas_maximas", string[]>
      >;
      error?: string;
      values?: ProvaFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): ProvaFormValuesEcho {
  return {
    titulo: String(formData.get("titulo") ?? ""),
    nota_minima_ativa: formData.get("nota_minima_ativa") === "on",
    nota_minima_percentual: String(formData.get("nota_minima_percentual") ?? ""),
    tentativas_limitadas: formData.get("tentativas_limitadas") === "on",
    tentativas_maximas: String(formData.get("tentativas_maximas") ?? ""),
  };
}

function parseProvaForm(formData: FormData) {
  return provaFormSchema.safeParse({
    titulo: formData.get("titulo"),
    nota_minima_ativa: formData.get("nota_minima_ativa") === "on",
    nota_minima_percentual: formData.get("nota_minima_percentual") || undefined,
    tentativas_limitadas: formData.get("tentativas_limitadas") === "on",
    tentativas_maximas: formData.get("tentativas_maximas") || undefined,
  });
}

function provaPath(cursoId: string, moduloId: string) {
  return `/admin/cursos/${cursoId}/modulos/${moduloId}/prova`;
}

export async function createProva(
  cursoId: string,
  moduloId: string,
  _prevState: ProvaFormState,
  formData: FormData,
): Promise<ProvaFormState> {
  await requireRole("admin");

  const parsed = parseProvaForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("provas").insert({
    modulo_id: moduloId,
    titulo: parsed.data.titulo,
    nota_minima_ativa: parsed.data.nota_minima_ativa,
    nota_minima_percentual: parsed.data.nota_minima_ativa
      ? parsed.data.nota_minima_percentual
      : null,
    tentativas_limitadas: parsed.data.tentativas_limitadas,
    tentativas_maximas: parsed.data.tentativas_limitadas ? parsed.data.tentativas_maximas : null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Esse módulo já tem uma prova.", values: echoValues(formData) };
    }
    return {
      error: "Não foi possível criar a prova. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(provaPath(cursoId, moduloId));
  redirect(provaPath(cursoId, moduloId));
}

export async function updateProva(
  cursoId: string,
  moduloId: string,
  provaId: string,
  _prevState: ProvaFormState,
  formData: FormData,
): Promise<ProvaFormState> {
  await requireRole("admin");

  const parsed = parseProvaForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("provas")
    .update({
      titulo: parsed.data.titulo,
      nota_minima_ativa: parsed.data.nota_minima_ativa,
      nota_minima_percentual: parsed.data.nota_minima_ativa
        ? parsed.data.nota_minima_percentual
        : null,
      tentativas_limitadas: parsed.data.tentativas_limitadas,
      tentativas_maximas: parsed.data.tentativas_limitadas ? parsed.data.tentativas_maximas : null,
    })
    .eq("id", provaId);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(provaPath(cursoId, moduloId));
  redirect(provaPath(cursoId, moduloId));
}

export async function deleteProva(
  cursoId: string,
  moduloId: string,
  provaId: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("provas").delete().eq("id", provaId);

  if (error) {
    return { error: "Não foi possível excluir a prova." };
  }

  revalidatePath(provaPath(cursoId, moduloId));
  return {};
}
