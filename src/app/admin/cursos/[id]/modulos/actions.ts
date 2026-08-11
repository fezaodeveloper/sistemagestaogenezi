"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { moduloFormSchema } from "@/lib/modulos/schema";
import { uploadImagem, validarImagem } from "@/lib/storage/validar-imagem";

const MODULOS_BUCKET = "modulos";

type ModuloFormValuesEcho = { numero: string; titulo: string; descricao: string };

export type ModuloFormState =
  | {
      errors?: Partial<Record<"numero" | "titulo" | "descricao" | "capa", string[]>>;
      error?: string;
      values?: ModuloFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): ModuloFormValuesEcho {
  return {
    numero: String(formData.get("numero") ?? ""),
    titulo: String(formData.get("titulo") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
  };
}

function parseModuloForm(formData: FormData) {
  return moduloFormSchema.safeParse({
    numero: formData.get("numero"),
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
  });
}

export async function createModulo(
  cursoId: string,
  _prevState: ModuloFormState,
  formData: FormData,
): Promise<ModuloFormState> {
  await requireRole("admin");

  const parsed = parseModuloForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const { erro: erroCapa, arquivo: arquivoCapa } = validarImagem(formData.get("capa"));
  if (erroCapa) {
    return { errors: { capa: [erroCapa] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let capaPath: string | null = null;
  if (arquivoCapa) {
    const { path, error: uploadError } = await uploadImagem(supabase, MODULOS_BUCKET, arquivoCapa);
    if (uploadError || !path) {
      return {
        error: "Não foi possível enviar a capa. Tente novamente.",
        values: echoValues(formData),
      };
    }
    capaPath = path;
  }

  const { error } = await supabase.from("modulos").insert({
    curso_id: cursoId,
    numero: parsed.data.numero,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao ?? null,
    capa_url: capaPath,
  });

  if (error) {
    if (capaPath) await supabase.storage.from(MODULOS_BUCKET).remove([capaPath]);
    if (error.code === "23505") {
      return {
        error: "Já existe um módulo com esse número neste curso.",
        values: echoValues(formData),
      };
    }
    return {
      error: "Não foi possível criar o módulo. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(`/admin/cursos/${cursoId}/modulos`);
  redirect(`/admin/cursos/${cursoId}/modulos`);
}

export async function updateModulo(
  cursoId: string,
  moduloId: string,
  capaAtual: string | null,
  _prevState: ModuloFormState,
  formData: FormData,
): Promise<ModuloFormState> {
  await requireRole("admin");

  const parsed = parseModuloForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const { erro: erroCapa, arquivo: arquivoCapa } = validarImagem(formData.get("capa"));
  if (erroCapa) {
    return { errors: { capa: [erroCapa] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let capaPath = capaAtual;
  let novoPath: string | null = null;
  if (arquivoCapa) {
    const { path, error: uploadError } = await uploadImagem(supabase, MODULOS_BUCKET, arquivoCapa);
    if (uploadError || !path) {
      return {
        error: "Não foi possível enviar a capa. Tente novamente.",
        values: echoValues(formData),
      };
    }
    novoPath = path;
    capaPath = path;
  }

  const { error } = await supabase
    .from("modulos")
    .update({
      numero: parsed.data.numero,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      capa_url: capaPath,
    })
    .eq("id", moduloId);

  if (error) {
    if (novoPath) await supabase.storage.from(MODULOS_BUCKET).remove([novoPath]);
    if (error.code === "23505") {
      return {
        error: "Já existe um módulo com esse número neste curso.",
        values: echoValues(formData),
      };
    }
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Só remove a capa antiga depois que a nova já está salva — evita
  // ficar sem capa nenhuma se o remove() falhar no meio do caminho.
  if (novoPath && capaAtual && capaAtual !== novoPath) {
    await supabase.storage.from(MODULOS_BUCKET).remove([capaAtual]);
  }

  revalidatePath(`/admin/cursos/${cursoId}/modulos`);
  redirect(`/admin/cursos/${cursoId}/modulos`);
}

export async function deleteModulo(cursoId: string, moduloId: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("modulos").delete().eq("id", moduloId);

  if (error) {
    return { error: "Não foi possível excluir o módulo." };
  }

  revalidatePath(`/admin/cursos/${cursoId}/modulos`);
  return {};
}
