"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cursoFormSchema } from "@/lib/cursos/schema";
import { cursoResgateFormSchema } from "@/lib/cursos/resgate-schema";
import { uploadImagem, validarImagem } from "@/lib/storage/validar-imagem";

const CURSOS_BUCKET = "cursos";

type CursoFormValuesEcho = { nome: string; descricao: string; tipo: string; status: string };

export type CursoFormState =
  | {
      errors?: Partial<Record<"nome" | "descricao" | "tipo" | "status" | "capa", string[]>>;
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

  const { erro: erroCapa, arquivo: arquivoCapa } = validarImagem(formData.get("capa"));
  if (erroCapa) {
    return { errors: { capa: [erroCapa] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let capaPath: string | null = null;
  if (arquivoCapa) {
    const { path, error: uploadError } = await uploadImagem(supabase, CURSOS_BUCKET, arquivoCapa);
    if (uploadError || !path) {
      return {
        error: "Não foi possível enviar a capa. Tente novamente.",
        values: echoValues(formData),
      };
    }
    capaPath = path;
  }

  const { error } = await supabase.from("cursos").insert({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao ?? null,
    tipo: parsed.data.tipo,
    status: parsed.data.status,
    capa_url: capaPath,
  });

  if (error) {
    if (capaPath) await supabase.storage.from(CURSOS_BUCKET).remove([capaPath]);
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
  capaAtual: string | null,
  _prevState: CursoFormState,
  formData: FormData,
): Promise<CursoFormState> {
  await requireRole("admin");

  const parsed = parseCursoForm(formData);
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
    const { path, error: uploadError } = await uploadImagem(supabase, CURSOS_BUCKET, arquivoCapa);
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
    .from("cursos")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      tipo: parsed.data.tipo,
      status: parsed.data.status,
      capa_url: capaPath,
    })
    .eq("id", id);

  if (error) {
    if (novoPath) await supabase.storage.from(CURSOS_BUCKET).remove([novoPath]);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Só remove a capa antiga depois que a nova já está salva — evita
  // ficar sem capa nenhuma se o remove() falhar no meio do caminho.
  if (novoPath && capaAtual && capaAtual !== novoPath) {
    await supabase.storage.from(CURSOS_BUCKET).remove([capaAtual]);
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

export type CursoResgateFormState =
  | {
      errors?: Partial<Record<"disponivel_para_resgate" | "custo_creditos", string[]>>;
      error?: string;
    }
  | undefined;

// Formulário separado do CursoForm principal — resgatabilidade só é
// configurada depois de o curso já existir (ver lib/cursos/resgate-schema).
export async function updateCursoResgate(
  id: string,
  _prevState: CursoResgateFormState,
  formData: FormData,
): Promise<CursoResgateFormState> {
  await requireRole("admin");

  const parsed = cursoResgateFormSchema.safeParse({
    disponivel_para_resgate: formData.get("disponivel_para_resgate") === "on",
    custo_creditos: formData.get("custo_creditos"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cursos")
    .update({
      disponivel_para_resgate: parsed.data.disponivel_para_resgate,
      custo_creditos: parsed.data.disponivel_para_resgate ? parsed.data.custo_creditos : null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath(`/admin/cursos/${id}/editar`);
  revalidatePath("/admin/cursos");
  return {};
}
