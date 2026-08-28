"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { treinamentoFormSchema, type Treinamento } from "@/lib/treinamentos/schema";

export async function getTreinamentos(): Promise<Treinamento[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("treinamentos").select("*").order("categoria").order("ordem");

  return (data as Treinamento[] | null) ?? [];
}

export async function getTreinamento(id: string): Promise<Treinamento | null> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase.from("treinamentos").select("*").eq("id", id).single();

  return (data as Treinamento | null) ?? null;
}

type TreinamentoFormValuesEcho = {
  titulo: string;
  descricao: string;
  categoria: string;
  youtube_url: string;
  status: string;
  ordem: string;
};

export type TreinamentoFormState =
  | {
      errors?: Partial<Record<keyof TreinamentoFormValuesEcho, string[]>>;
      error?: string;
      values?: TreinamentoFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): TreinamentoFormValuesEcho {
  return {
    titulo: String(formData.get("titulo") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
    categoria: String(formData.get("categoria") ?? ""),
    youtube_url: String(formData.get("youtube_url") ?? ""),
    status: String(formData.get("status") ?? ""),
    ordem: String(formData.get("ordem") ?? ""),
  };
}

function parseTreinamentoForm(formData: FormData) {
  return treinamentoFormSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    categoria: formData.get("categoria"),
    youtube_url: formData.get("youtube_url"),
    status: formData.get("status"),
    ordem: formData.get("ordem"),
  });
}

export async function createTreinamento(
  _prevState: TreinamentoFormState,
  formData: FormData,
): Promise<TreinamentoFormState> {
  await requireRole("admin");

  const parsed = parseTreinamentoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("treinamentos").insert({
    titulo: data.titulo,
    descricao: data.descricao ?? null,
    categoria: data.categoria,
    youtube_url: data.youtube_url,
    status: data.status,
    ordem: data.ordem,
  });

  if (error) {
    return {
      error: "Não foi possível criar o treinamento. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

export async function updateTreinamento(
  id: string,
  _prevState: TreinamentoFormState,
  formData: FormData,
): Promise<TreinamentoFormState> {
  await requireRole("admin");

  const parsed = parseTreinamentoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("treinamentos")
    .update({
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      categoria: data.categoria,
      youtube_url: data.youtube_url,
      status: data.status,
      ordem: data.ordem,
    })
    .eq("id", id);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/treinamentos");
  redirect("/admin/treinamentos");
}

export async function deleteTreinamento(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("treinamentos").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o treinamento." };
  }

  revalidatePath("/admin/treinamentos");
  return {};
}

// Não tem UI de drag-and-drop chamando isso ainda — nenhuma das telas
// pedidas (lista, formulário) tinha reordenação por arrastar. Criada como
// pedido na especificação, pronta pro dia em que uma UI de reordenar for
// adicionada; até lá, "ordem" só é editável campo a campo no formulário.
export async function reordenarTreinamentos(ids: string[]): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const resultados = await Promise.all(
    ids.map((id, indice) => supabase.from("treinamentos").update({ ordem: indice }).eq("id", id)),
  );

  if (resultados.some((resultado) => resultado.error)) {
    return { error: "Não foi possível reordenar os treinamentos." };
  }

  revalidatePath("/admin/treinamentos");
  return {};
}
