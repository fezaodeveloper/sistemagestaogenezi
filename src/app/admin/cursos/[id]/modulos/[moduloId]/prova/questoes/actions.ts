"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { QUESTAO_TIPOS, questaoBaseFormSchema } from "@/lib/questoes/schema";

type QuestaoProvaFormValuesEcho = { tipo: string; enunciado: string; ordem: string };

export type QuestaoProvaFormState =
  | {
      errors?: Partial<Record<"tipo" | "enunciado" | "ordem" | "alternativas", string[]>>;
      error?: string;
      values?: QuestaoProvaFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): QuestaoProvaFormValuesEcho {
  return {
    tipo: String(formData.get("tipo") ?? ""),
    enunciado: String(formData.get("enunciado") ?? ""),
    ordem: String(formData.get("ordem") ?? ""),
  };
}

function parseTipo(formData: FormData) {
  const tipo = formData.get("tipo");
  if (typeof tipo !== "string" || !QUESTAO_TIPOS.includes(tipo as (typeof QUESTAO_TIPOS)[number])) {
    return null;
  }
  return tipo as (typeof QUESTAO_TIPOS)[number];
}

// Não filtra alternativas em branco antes de checar o índice da correta —
// se filtrasse, o índice submetido (baseado na posição original na tela)
// poderia deixar de bater com o array filtrado.
function buildAlternativas(
  formData: FormData,
  tipo: (typeof QUESTAO_TIPOS)[number],
): { rows: { texto: string; correta: boolean }[] } | { error: string } {
  if (tipo === "dissertativa") {
    return { rows: [] };
  }

  if (tipo === "verdadeiro_falso") {
    const correta = formData.get("alternativa_correta");
    if (correta !== "0" && correta !== "1") {
      return { error: "Selecione qual alternativa é a correta." };
    }
    return {
      rows: [
        { texto: "Verdadeiro", correta: correta === "0" },
        { texto: "Falso", correta: correta === "1" },
      ],
    };
  }

  const textosRaw = formData.getAll("alternativa_texto").map((v) => String(v));
  if (textosRaw.some((t) => t.trim().length === 0)) {
    return { error: "Preencha o texto de todas as alternativas." };
  }
  const textos = textosRaw.map((t) => t.trim());
  if (textos.length < 2) {
    return { error: "Informe pelo menos 2 alternativas." };
  }

  const correta = formData.get("alternativa_correta");
  const correctIndex = correta === null ? -1 : Number(correta);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= textos.length) {
    return { error: "Selecione qual alternativa é a correta." };
  }

  return { rows: textos.map((texto, index) => ({ texto, correta: index === correctIndex })) };
}

function provaPath(cursoId: string, moduloId: string) {
  return `/admin/cursos/${cursoId}/modulos/${moduloId}/prova`;
}

export async function createQuestaoProva(
  cursoId: string,
  moduloId: string,
  provaId: string,
  _prevState: QuestaoProvaFormState,
  formData: FormData,
): Promise<QuestaoProvaFormState> {
  await requireRole("admin");

  const tipo = parseTipo(formData);
  if (!tipo) {
    return { error: "Selecione o tipo da questão.", values: echoValues(formData) };
  }

  const parsed = questaoBaseFormSchema.safeParse({
    enunciado: formData.get("enunciado"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const alternativas = buildAlternativas(formData, tipo);
  if ("error" in alternativas) {
    return {
      errors: { alternativas: [alternativas.error] },
      values: echoValues(formData),
    };
  }

  const supabase = await createClient();
  const { data: questao, error } = await supabase
    .from("questoes_prova")
    .insert({ prova_id: provaId, tipo, enunciado: parsed.data.enunciado, ordem: parsed.data.ordem })
    .select()
    .single();

  if (error || !questao) {
    return {
      error: "Não foi possível criar a questão. Tente novamente.",
      values: echoValues(formData),
    };
  }

  if (alternativas.rows.length > 0) {
    const { error: alternativasError } = await supabase.from("alternativas_prova").insert(
      alternativas.rows.map((row, index) => ({
        questao_prova_id: questao.id,
        texto: row.texto,
        correta: row.correta,
        ordem: index + 1,
      })),
    );

    if (alternativasError) {
      await supabase.from("questoes_prova").delete().eq("id", questao.id);
      return {
        error: "Não foi possível salvar as alternativas. Tente novamente.",
        values: echoValues(formData),
      };
    }
  }

  revalidatePath(provaPath(cursoId, moduloId));
  redirect(provaPath(cursoId, moduloId));
}

export async function updateQuestaoProva(
  cursoId: string,
  moduloId: string,
  questaoProvaId: string,
  _prevState: QuestaoProvaFormState,
  formData: FormData,
): Promise<QuestaoProvaFormState> {
  await requireRole("admin");

  const tipo = parseTipo(formData);
  if (!tipo) {
    return { error: "Selecione o tipo da questão.", values: echoValues(formData) };
  }

  const parsed = questaoBaseFormSchema.safeParse({
    enunciado: formData.get("enunciado"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const alternativas = buildAlternativas(formData, tipo);
  if ("error" in alternativas) {
    return {
      errors: { alternativas: [alternativas.error] },
      values: echoValues(formData),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("questoes_prova")
    .update({ tipo, enunciado: parsed.data.enunciado, ordem: parsed.data.ordem })
    .eq("id", questaoProvaId);

  if (error) {
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Reconstrói o conjunto de alternativas do zero — mesmo raciocínio do
  // quiz: o formulário trata o conjunto inteiro como "isto é o estado
  // correto agora", não tenta diferenciar quais linhas mudaram.
  const { error: deleteError } = await supabase
    .from("alternativas_prova")
    .delete()
    .eq("questao_prova_id", questaoProvaId);

  if (deleteError) {
    return {
      error: "Não foi possível salvar as alternativas. Tente novamente.",
      values: echoValues(formData),
    };
  }

  if (alternativas.rows.length > 0) {
    const { error: insertError } = await supabase.from("alternativas_prova").insert(
      alternativas.rows.map((row, index) => ({
        questao_prova_id: questaoProvaId,
        texto: row.texto,
        correta: row.correta,
        ordem: index + 1,
      })),
    );

    if (insertError) {
      return {
        error: "Não foi possível salvar as alternativas. Tente novamente.",
        values: echoValues(formData),
      };
    }
  }

  revalidatePath(provaPath(cursoId, moduloId));
  redirect(provaPath(cursoId, moduloId));
}

export async function deleteQuestaoProva(
  cursoId: string,
  moduloId: string,
  questaoProvaId: string,
): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("questoes_prova").delete().eq("id", questaoProvaId);

  if (error) {
    return { error: "Não foi possível excluir a questão." };
  }

  revalidatePath(provaPath(cursoId, moduloId));
  return {};
}
