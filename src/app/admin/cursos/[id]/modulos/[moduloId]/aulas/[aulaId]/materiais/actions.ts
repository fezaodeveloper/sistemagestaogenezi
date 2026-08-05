"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  MATERIAL_TIPOS,
  materialPdfMetaFormSchema,
  materialUrlFormSchema,
  type Material,
} from "@/lib/materiais/schema";

const MATERIAIS_BUCKET = "materiais";

type MaterialFormValuesEcho = { tipo: string; titulo: string; ordem: string; url: string };

export type MaterialFormState =
  | {
      errors?: Partial<Record<"tipo" | "titulo" | "ordem" | "url" | "arquivo", string[]>>;
      error?: string;
      values?: MaterialFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): MaterialFormValuesEcho {
  return {
    tipo: String(formData.get("tipo") ?? ""),
    titulo: String(formData.get("titulo") ?? ""),
    ordem: String(formData.get("ordem") ?? ""),
    url: String(formData.get("url") ?? ""),
  };
}

function parseTipo(formData: FormData) {
  const tipo = formData.get("tipo");
  if (
    typeof tipo !== "string" ||
    !MATERIAL_TIPOS.includes(tipo as (typeof MATERIAL_TIPOS)[number])
  ) {
    return null;
  }
  return tipo as (typeof MATERIAL_TIPOS)[number];
}

async function uploadPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aulaId: string,
  file: File,
) {
  const path = `${aulaId}/${randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(MATERIAIS_BUCKET)
    .upload(path, file, { contentType: "application/pdf" });
  return { path: error ? null : path, error };
}

function materiaisPath(cursoId: string, moduloId: string, aulaId: string) {
  return `/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/materiais`;
}

export async function createMaterial(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireRole("admin");

  const tipo = parseTipo(formData);
  if (!tipo) {
    return { error: "Selecione o tipo do material.", values: echoValues(formData) };
  }

  const supabase = await createClient();

  if (tipo === "pdf") {
    const parsed = materialPdfMetaFormSchema.safeParse({
      titulo: formData.get("titulo"),
      ordem: formData.get("ordem"),
    });
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
    }

    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { errors: { arquivo: ["Selecione um arquivo PDF."] }, values: echoValues(formData) };
    }
    if (arquivo.type !== "application/pdf") {
      return {
        errors: { arquivo: ["O arquivo precisa ser um PDF."] },
        values: echoValues(formData),
      };
    }

    const { path, error: uploadError } = await uploadPdf(supabase, aulaId, arquivo);
    if (uploadError || !path) {
      return {
        error: "Não foi possível enviar o arquivo. Tente novamente.",
        values: echoValues(formData),
      };
    }

    const { error } = await supabase.from("materiais").insert({
      aula_id: aulaId,
      tipo: "pdf",
      titulo: parsed.data.titulo,
      url: path,
      ordem: parsed.data.ordem,
    });
    if (error) {
      await supabase.storage.from(MATERIAIS_BUCKET).remove([path]);
      return {
        error: "Não foi possível criar o material. Tente novamente.",
        values: echoValues(formData),
      };
    }
  } else {
    const parsed = materialUrlFormSchema.safeParse({
      titulo: formData.get("titulo"),
      ordem: formData.get("ordem"),
      url: formData.get("url"),
    });
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
    }

    const { error } = await supabase.from("materiais").insert({
      aula_id: aulaId,
      tipo,
      titulo: parsed.data.titulo,
      url: parsed.data.url,
      ordem: parsed.data.ordem,
    });
    if (error) {
      return {
        error: "Não foi possível criar o material. Tente novamente.",
        values: echoValues(formData),
      };
    }
  }

  revalidatePath(materiaisPath(cursoId, moduloId, aulaId));
  redirect(materiaisPath(cursoId, moduloId, aulaId));
}

export async function updateMaterial(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  materialId: string,
  current: Pick<Material, "tipo" | "url">,
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireRole("admin");

  const tipo = parseTipo(formData);
  if (!tipo) {
    return { error: "Selecione o tipo do material.", values: echoValues(formData) };
  }

  const supabase = await createClient();

  if (tipo === "pdf") {
    const parsed = materialPdfMetaFormSchema.safeParse({
      titulo: formData.get("titulo"),
      ordem: formData.get("ordem"),
    });
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
    }

    const arquivo = formData.get("arquivo");
    let path = current.tipo === "pdf" ? current.url : null;
    let novoPath: string | null = null;

    if (arquivo instanceof File && arquivo.size > 0) {
      if (arquivo.type !== "application/pdf") {
        return {
          errors: { arquivo: ["O arquivo precisa ser um PDF."] },
          values: echoValues(formData),
        };
      }
      const { path: uploadedPath, error: uploadError } = await uploadPdf(supabase, aulaId, arquivo);
      if (uploadError || !uploadedPath) {
        return {
          error: "Não foi possível enviar o arquivo. Tente novamente.",
          values: echoValues(formData),
        };
      }
      novoPath = uploadedPath;
      path = uploadedPath;
    }

    if (!path) {
      return { errors: { arquivo: ["Selecione um arquivo PDF."] }, values: echoValues(formData) };
    }

    const { error } = await supabase
      .from("materiais")
      .update({ tipo: "pdf", titulo: parsed.data.titulo, url: path, ordem: parsed.data.ordem })
      .eq("id", materialId);

    if (error) {
      if (novoPath) await supabase.storage.from(MATERIAIS_BUCKET).remove([novoPath]);
      return {
        error: "Não foi possível salvar as alterações. Tente novamente.",
        values: echoValues(formData),
      };
    }

    // Só remove o arquivo antigo depois que o novo caminho já está salvo —
    // evita ficar sem arquivo nenhum se o remove() falhar no meio do caminho.
    if (novoPath && current.tipo === "pdf" && current.url !== novoPath) {
      await supabase.storage.from(MATERIAIS_BUCKET).remove([current.url]);
    }
  } else {
    const parsed = materialUrlFormSchema.safeParse({
      titulo: formData.get("titulo"),
      ordem: formData.get("ordem"),
      url: formData.get("url"),
    });
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
    }

    const { error } = await supabase
      .from("materiais")
      .update({
        tipo,
        titulo: parsed.data.titulo,
        url: parsed.data.url,
        ordem: parsed.data.ordem,
      })
      .eq("id", materialId);

    if (error) {
      return {
        error: "Não foi possível salvar as alterações. Tente novamente.",
        values: echoValues(formData),
      };
    }

    // Trocou de pdf para um tipo com URL externa — o arquivo antigo no
    // Storage não tem mais dono, remove pra não ficar órfão.
    if (current.tipo === "pdf") {
      await supabase.storage.from(MATERIAIS_BUCKET).remove([current.url]);
    }
  }

  revalidatePath(materiaisPath(cursoId, moduloId, aulaId));
  redirect(materiaisPath(cursoId, moduloId, aulaId));
}

export async function deleteMaterial(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  materialId: string,
  tipo: Material["tipo"],
  url: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("materiais").delete().eq("id", materialId);

  if (error) {
    return { error: "Não foi possível excluir o material." };
  }

  if (tipo === "pdf") {
    await supabase.storage.from(MATERIAIS_BUCKET).remove([url]);
  }

  revalidatePath(materiaisPath(cursoId, moduloId, aulaId));
  return {};
}
