"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type DetalheQuestao = {
  id: string;
  enunciado: string;
  tipo: "multipla_escolha" | "verdadeiro_falso" | "dissertativa";
  ordem: number;
  respostaAlunoTexto: string | null;
  correta: boolean | null; // null = dissertativa, sem correção automática
  gabaritoTexto: string | null; // texto da alternativa correta (null se dissertativa)
};

type RespostaQuizRow = {
  id: string;
  resposta_texto: string | null;
  correta: boolean | null;
  alternativa_id: string | null;
  questoes: {
    id: string;
    enunciado: string;
    tipo: DetalheQuestao["tipo"];
    ordem: number;
    alternativas: { id: string; texto: string; correta: boolean }[];
  } | null;
};

type RespostaProvaRow = {
  id: string;
  resposta_texto: string | null;
  correta: boolean | null;
  alternativa_prova_id: string | null;
  questoes_prova: {
    id: string;
    enunciado: string;
    tipo: DetalheQuestao["tipo"];
    ordem: number;
    alternativas_prova: { id: string; texto: string; correta: boolean }[];
  } | null;
};

// Detalhe de UMA tentativa: cada questão, o que o aluno respondeu e o gabarito. RLS de
// respostas_quiz/respostas_prova + questoes/alternativas já dá select amplo pro admin
// (is_admin()) — não precisa de client admin/service_role aqui.
export async function listarDetalhesTentativa(
  tipo: "quiz" | "prova",
  tentativaId: string,
): Promise<{ questoes: DetalheQuestao[] } | { erro: string }> {
  await requireRole("admin");
  const supabase = await createClient();

  if (tipo === "quiz") {
    const { data, error } = await supabase
      .from("respostas_quiz")
      .select("id, resposta_texto, correta, alternativa_id, questoes(id, enunciado, tipo, ordem, alternativas(id, texto, correta))")
      .eq("tentativa_id", tentativaId);

    if (error) {
      console.error("[listarDetalhesTentativa] erro (quiz):", error);
      return { erro: "Não foi possível carregar os detalhes desta tentativa." };
    }

    const linhas = (data ?? []) as unknown as RespostaQuizRow[];
    const questoes: DetalheQuestao[] = linhas
      .filter((linha) => linha.questoes)
      .map((linha) => {
        const questao = linha.questoes!;
        const escolhida = questao.alternativas.find((alt) => alt.id === linha.alternativa_id);
        const gabarito = questao.alternativas.find((alt) => alt.correta);
        return {
          id: questao.id,
          enunciado: questao.enunciado,
          tipo: questao.tipo,
          ordem: questao.ordem,
          respostaAlunoTexto: questao.tipo === "dissertativa" ? linha.resposta_texto : (escolhida?.texto ?? null),
          correta: linha.correta,
          gabaritoTexto: questao.tipo === "dissertativa" ? null : (gabarito?.texto ?? null),
        };
      })
      .sort((a, b) => a.ordem - b.ordem);

    return { questoes };
  }

  const { data, error } = await supabase
    .from("respostas_prova")
    .select(
      "id, resposta_texto, correta, alternativa_prova_id, questoes_prova(id, enunciado, tipo, ordem, alternativas_prova(id, texto, correta))",
    )
    .eq("tentativa_id", tentativaId);

  if (error) {
    console.error("[listarDetalhesTentativa] erro (prova):", error);
    return { erro: "Não foi possível carregar os detalhes desta tentativa." };
  }

  const linhas = (data ?? []) as unknown as RespostaProvaRow[];
  const questoes: DetalheQuestao[] = linhas
    .filter((linha) => linha.questoes_prova)
    .map((linha) => {
      const questao = linha.questoes_prova!;
      const escolhida = questao.alternativas_prova.find((alt) => alt.id === linha.alternativa_prova_id);
      const gabarito = questao.alternativas_prova.find((alt) => alt.correta);
      return {
        id: questao.id,
        enunciado: questao.enunciado,
        tipo: questao.tipo,
        ordem: questao.ordem,
        respostaAlunoTexto: questao.tipo === "dissertativa" ? linha.resposta_texto : (escolhida?.texto ?? null),
        correta: linha.correta,
        gabaritoTexto: questao.tipo === "dissertativa" ? null : (gabarito?.texto ?? null),
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  return { questoes };
}
