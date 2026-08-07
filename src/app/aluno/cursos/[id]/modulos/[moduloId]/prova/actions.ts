"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMatriculaIdAtivaParaCurso } from "@/lib/matriculas/access";

export type SubmeterProvaState = { error?: string } | undefined;

// Mesmo desenho do quiz (ver .../aulas/[aulaId]/quiz/actions.ts): validação
// de "respondeu tudo" e do limite de tentativas acontece aqui, mas a
// CORREÇÃO em si roda dentro da function SQL criar_tentativa_prova — nunca
// confiamos em nota/correta calculados no client.
export async function submeterTentativaProva(
  cursoId: string,
  moduloId: string,
  provaId: string,
  _prevState: SubmeterProvaState,
  formData: FormData,
): Promise<SubmeterProvaState> {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  const matriculaId = await getMatriculaIdAtivaParaCurso(supabase, user.id, cursoId);
  if (!matriculaId) {
    return { error: "Matrícula não encontrada." };
  }

  const { data: prova } = await supabase
    .from("provas")
    .select("tentativas_limitadas, tentativas_maximas")
    .eq("id", provaId)
    .single();
  if (!prova) {
    return { error: "Prova não encontrada." };
  }

  if (prova.tentativas_limitadas) {
    const { count } = await supabase
      .from("tentativas_prova")
      .select("id", { count: "exact", head: true })
      .eq("prova_id", provaId)
      .eq("matricula_id", matriculaId);
    if ((count ?? 0) >= (prova.tentativas_maximas ?? 0)) {
      return { error: "Você atingiu o limite de tentativas para esta prova." };
    }
  }

  const { data: questoes } = await supabase
    .from("questoes_prova")
    .select("id, tipo")
    .eq("prova_id", provaId);
  if (!questoes || questoes.length === 0) {
    return { error: "Esta prova não tem questões." };
  }

  const questaoIds: string[] = [];
  const alternativaIds: (string | null)[] = [];
  const textos: (string | null)[] = [];

  for (const questao of questoes) {
    const valor = formData.get(`questao_${questao.id}`);
    questaoIds.push(questao.id);

    if (questao.tipo === "dissertativa") {
      const texto = typeof valor === "string" ? valor.trim() : "";
      if (!texto) {
        return { error: "Responda todas as questões antes de enviar." };
      }
      textos.push(texto);
      alternativaIds.push(null);
    } else {
      if (typeof valor !== "string" || !valor) {
        return { error: "Responda todas as questões antes de enviar." };
      }
      alternativaIds.push(valor);
      textos.push(null);
    }
  }

  const { error } = await supabase.rpc("criar_tentativa_prova", {
    p_prova_id: provaId,
    p_matricula_id: matriculaId,
    p_questao_ids: questaoIds,
    p_alternativa_ids: alternativaIds,
    p_textos: textos,
  });

  if (error) {
    return { error: "Não foi possível enviar suas respostas. Tente novamente." };
  }

  redirect(`/aluno/cursos/${cursoId}/modulos/${moduloId}/prova`);
}
