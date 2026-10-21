"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { cursoGratuitoFormSchema } from "@/lib/cursos/schema";

type CursoGratuitoFormValuesEcho = {
  nome: string;
  descricao: string;
  url_plataforma_externa: string;
  status: string;
};

export type CursoGratuitoFormState =
  | {
      errors?: Partial<Record<"nome" | "descricao" | "url_plataforma_externa" | "status", string[]>>;
      error?: string;
      values?: CursoGratuitoFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): CursoGratuitoFormValuesEcho {
  return {
    nome: String(formData.get("nome") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
    url_plataforma_externa: String(formData.get("url_plataforma_externa") ?? ""),
    status: String(formData.get("status") ?? ""),
  };
}

function parseCursoGratuitoForm(formData: FormData) {
  return cursoGratuitoFormSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    url_plataforma_externa: formData.get("url_plataforma_externa"),
    status: formData.get("status"),
  });
}

export async function criarCursoGratuito(
  _prevState: CursoGratuitoFormState,
  formData: FormData,
): Promise<CursoGratuitoFormState> {
  await requireRole("admin");

  const parsed = parseCursoGratuitoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("cursos").insert({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao ?? null,
    url_plataforma_externa: parsed.data.url_plataforma_externa,
    status: parsed.data.status,
    // Curso gratuito é sempre hospedado numa plataforma externa — "tipo" não tem equivalente
    // real pra esse caso, mas a coluna é not null sem default; "ead" é o mais próximo.
    tipo: "ead",
    gratuito: true,
  });

  if (error) {
    return {
      error: "Não foi possível criar o curso gratuito. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/cursos-gratuitos");
  redirect("/admin/cursos-gratuitos");
}

export async function atualizarCursoGratuito(
  id: string,
  _prevState: CursoGratuitoFormState,
  formData: FormData,
): Promise<CursoGratuitoFormState> {
  await requireRole("admin");

  const parsed = parseCursoGratuitoForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("cursos")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      url_plataforma_externa: parsed.data.url_plataforma_externa,
      status: parsed.data.status,
    })
    .eq("id", id)
    .eq("gratuito", true);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/cursos-gratuitos");
  redirect("/admin/cursos-gratuitos");
}

// Toggle rápido de status direto na listagem (coluna "Ativo") — não precisa da página de edição
// completa pra uma mudança binária como essa, mesmo racional de outros toggles rápidos do admin.
export async function atualizarStatusCursoGratuito(id: string, ativo: boolean): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cursos")
    .update({ status: ativo ? "ativo" : "inativo" })
    .eq("id", id)
    .eq("gratuito", true);

  if (error) {
    return { error: "Não foi possível atualizar o status. Tente novamente." };
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}

export async function excluirCursoGratuito(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();

  // gratuito = true na condição: mesmo cuidado de atualizarCursoGratuito acima — esta action só
  // pode agir sobre cursos gratuitos, nunca sobre o catálogo de cursos regulares.
  const { error } = await supabase.from("cursos").delete().eq("id", id).eq("gratuito", true);

  if (error) {
    // 23503 = foreign_key_violation — mesmo código já tratado em deleteCurso
    // (src/app/admin/cursos/actions.ts) pra turmas/leads/matrículas vinculadas.
    if (error.code === "23503") {
      return {
        error: "Não é possível excluir: ainda existem turmas, matrículas ou leads vinculados a este curso.",
      };
    }
    return { error: "Não foi possível excluir o curso gratuito. Tente novamente." };
  }

  revalidatePath("/admin/cursos-gratuitos");
  return {};
}
