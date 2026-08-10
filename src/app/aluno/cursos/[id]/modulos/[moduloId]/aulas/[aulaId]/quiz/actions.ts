"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getExpiracaoMatricula, getMatriculaIdAtivaParaCurso } from "@/lib/matriculas/access";

export type SubmeterQuizState = { error?: string } | undefined;

// Validação de "respondeu tudo" e do limite de tentativas acontece aqui,
// mas a CORREÇÃO em si (o que é "certo") roda dentro da function SQL
// criar_tentativa_quiz — nunca confiamos em nota/correta calculados no
// client. A function também recalcula o número da tentativa dentro da
// mesma transação, evitando corrida entre "checar limite" e "inserir".
export async function submeterTentativaQuiz(
  cursoId: string,
  moduloId: string,
  aulaId: string,
  quizId: string,
  _prevState: SubmeterQuizState,
  formData: FormData,
): Promise<SubmeterQuizState> {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  const matriculaId = await getMatriculaIdAtivaParaCurso(supabase, user.id, cursoId);
  if (!matriculaId) {
    return { error: "Matrícula não encontrada." };
  }

  // Mensagem amigável — a fronteira de verdade é o próprio
  // criar_tentativa_quiz, que reimplementa essa checagem (RPC direto
  // bypassando essa Server Action não escapa dela).
  const expiracao = await getExpiracaoMatricula(supabase, matriculaId);
  if (expiracao?.expirada) {
    return { error: "Sua matrícula expirou. Fale com a administração para renovar o acesso." };
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("tentativas_limitadas, tentativas_maximas")
    .eq("id", quizId)
    .single();
  if (!quiz) {
    return { error: "Quiz não encontrado." };
  }

  if (quiz.tentativas_limitadas) {
    const { count } = await supabase
      .from("tentativas_quiz")
      .select("id", { count: "exact", head: true })
      .eq("quiz_id", quizId)
      .eq("matricula_id", matriculaId);
    if ((count ?? 0) >= (quiz.tentativas_maximas ?? 0)) {
      return { error: "Você atingiu o limite de tentativas para este quiz." };
    }
  }

  const { data: questoes } = await supabase
    .from("questoes")
    .select("id, tipo")
    .eq("quiz_id", quizId);
  if (!questoes || questoes.length === 0) {
    return { error: "Este quiz não tem questões." };
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

  const { error } = await supabase.rpc("criar_tentativa_quiz", {
    p_quiz_id: quizId,
    p_matricula_id: matriculaId,
    p_questao_ids: questaoIds,
    p_alternativa_ids: alternativaIds,
    p_textos: textos,
  });

  if (error) {
    return { error: "Não foi possível enviar suas respostas. Tente novamente." };
  }

  redirect(`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}/quiz`);
}
