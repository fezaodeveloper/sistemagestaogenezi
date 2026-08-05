"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { quizFormSchema } from "@/lib/quizzes/schema";

type QuizFormValuesEcho = {
  titulo: string;
  nota_minima_ativa: boolean;
  nota_minima_percentual: string;
  tentativas_limitadas: boolean;
  tentativas_maximas: string;
};

export type QuizFormState =
  | {
      errors?: Partial<
        Record<"titulo" | "nota_minima_percentual" | "tentativas_maximas", string[]>
      >;
      error?: string;
      values?: QuizFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): QuizFormValuesEcho {
  return {
    titulo: String(formData.get("titulo") ?? ""),
    nota_minima_ativa: formData.get("nota_minima_ativa") === "on",
    nota_minima_percentual: String(formData.get("nota_minima_percentual") ?? ""),
    tentativas_limitadas: formData.get("tentativas_limitadas") === "on",
    tentativas_maximas: String(formData.get("tentativas_maximas") ?? ""),
  };
}

function parseQuizForm(formData: FormData) {
  return quizFormSchema.safeParse({
    titulo: formData.get("titulo"),
    nota_minima_ativa: formData.get("nota_minima_ativa") === "on",
    nota_minima_percentual: formData.get("nota_minima_percentual") || undefined,
    tentativas_limitadas: formData.get("tentativas_limitadas") === "on",
    tentativas_maximas: formData.get("tentativas_maximas") || undefined,
  });
}

function quizPath(cursoId: string, moduloId: string, aulaId: string) {
  return `/admin/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz`;
}

export async function createQuiz(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  _prevState: QuizFormState,
  formData: FormData,
): Promise<QuizFormState> {
  await requireRole("admin");

  const parsed = parseQuizForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("quizzes").insert({
    aula_id: aulaId,
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
      return { error: "Essa aula já tem um quiz.", values: echoValues(formData) };
    }
    return {
      error: "Não foi possível criar o quiz. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(quizPath(cursoId, moduloId, aulaId));
  redirect(quizPath(cursoId, moduloId, aulaId));
}

export async function updateQuiz(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  quizId: string,
  _prevState: QuizFormState,
  formData: FormData,
): Promise<QuizFormState> {
  await requireRole("admin");

  const parsed = parseQuizForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("quizzes")
    .update({
      titulo: parsed.data.titulo,
      nota_minima_ativa: parsed.data.nota_minima_ativa,
      nota_minima_percentual: parsed.data.nota_minima_ativa
        ? parsed.data.nota_minima_percentual
        : null,
      tentativas_limitadas: parsed.data.tentativas_limitadas,
      tentativas_maximas: parsed.data.tentativas_limitadas ? parsed.data.tentativas_maximas : null,
    })
    .eq("id", quizId);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath(quizPath(cursoId, moduloId, aulaId));
  redirect(quizPath(cursoId, moduloId, aulaId));
}

export async function deleteQuiz(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  quizId: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);

  if (error) {
    return { error: "Não foi possível excluir o quiz." };
  }

  revalidatePath(quizPath(cursoId, moduloId, aulaId));
  return {};
}
