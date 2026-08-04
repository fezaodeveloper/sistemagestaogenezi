"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { aulaFormSchema } from "@/lib/aulas/schema";

type AulaFormValuesEcho = { numero: string; titulo: string; conteudo: string };

export type AulaFormState =
  | {
      errors?: Partial<Record<"numero" | "titulo" | "conteudo", string[]>>;
      error?: string;
      values?: AulaFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): AulaFormValuesEcho {
  return {
    numero: String(formData.get("numero") ?? ""),
    titulo: String(formData.get("titulo") ?? ""),
    conteudo: String(formData.get("conteudo") ?? ""),
  };
}

function parseAulaForm(formData: FormData) {
  return aulaFormSchema.safeParse({
    numero: formData.get("numero"),
    titulo: formData.get("titulo"),
    conteudo: formData.get("conteudo") || undefined,
  });
}

export async function createAula(
  cursoId: string,
  _prevState: AulaFormState,
  formData: FormData,
): Promise<AulaFormState> {
  await requireRole("admin");

  const parsed = parseAulaForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("aulas").insert({
    curso_id: cursoId,
    numero: parsed.data.numero,
    titulo: parsed.data.titulo,
    conteudo: parsed.data.conteudo ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "Já existe uma aula com esse número neste curso.",
        values: echoValues(formData),
      };
    }
    return {
      error: "Não foi possível criar a aula. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(`/admin/cursos/${cursoId}/aulas`);
  redirect(`/admin/cursos/${cursoId}/aulas`);
}

export async function updateAula(
  cursoId: string,
  aulaId: string,
  _prevState: AulaFormState,
  formData: FormData,
): Promise<AulaFormState> {
  await requireRole("admin");

  const parsed = parseAulaForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("aulas")
    .update({
      numero: parsed.data.numero,
      titulo: parsed.data.titulo,
      conteudo: parsed.data.conteudo ?? null,
    })
    .eq("id", aulaId);

  if (error) {
    if (error.code === "23505") {
      return {
        error: "Já existe uma aula com esse número neste curso.",
        values: echoValues(formData),
      };
    }
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(`/admin/cursos/${cursoId}/aulas`);
  redirect(`/admin/cursos/${cursoId}/aulas`);
}

export async function deleteAula(cursoId: string, aulaId: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("aulas").delete().eq("id", aulaId);

  if (error) {
    return { error: "Não foi possível excluir a aula." };
  }

  revalidatePath(`/admin/cursos/${cursoId}/aulas`);
  return {};
}
