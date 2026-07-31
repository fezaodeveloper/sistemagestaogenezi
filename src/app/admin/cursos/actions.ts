"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cursoFormSchema } from "@/lib/cursos/schema";

type CursoFormValuesEcho = { nome: string; descricao: string; tipo: string; status: string };

export type CursoFormState =
  | {
      errors?: Partial<Record<"nome" | "descricao" | "tipo" | "status", string[]>>;
      error?: string;
      values?: CursoFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): CursoFormValuesEcho {
  return {
    nome: String(formData.get("nome") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
}

function parseCursoForm(formData: FormData) {
  return cursoFormSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    tipo: formData.get("tipo"),
    status: formData.get("status"),
  });
}

export async function createCurso(
  _prevState: CursoFormState,
  formData: FormData,
): Promise<CursoFormState> {
  await requireRole("admin");

  const parsed = parseCursoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cursos").insert({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao ?? null,
    tipo: parsed.data.tipo,
    status: parsed.data.status,
  });

  if (error) {
    return {
      error: "Não foi possível criar o curso. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/cursos");
  redirect("/admin/cursos");
}

export async function updateCurso(
  id: string,
  _prevState: CursoFormState,
  formData: FormData,
): Promise<CursoFormState> {
  await requireRole("admin");

  const parsed = parseCursoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cursos")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      tipo: parsed.data.tipo,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/cursos");
  redirect("/admin/cursos");
}

export async function deleteCurso(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("cursos").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return { error: "Esse curso tem turmas cadastradas — exclua as turmas primeiro." };
    }
    return { error: "Não foi possível excluir o curso." };
  }

  revalidatePath("/admin/cursos");
  return {};
}
