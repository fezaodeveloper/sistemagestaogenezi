import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { alunoTemAcessoAoCurso, getMatriculaIdAtivaParaCurso } from "@/lib/matriculas/access";
import type { Quiz } from "@/lib/quizzes/schema";
import { QuizAnswerForm } from "@/components/aluno/quiz-answer-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submeterTentativaQuiz } from "./actions";

type AulaRow = {
  id: string;
  titulo: string;
  modulo_id: string;
  modulos: { id: string; numero: number; titulo: string; curso_id: string } | null;
};

type QuestaoTipo = "multipla_escolha" | "verdadeiro_falso" | "dissertativa";

type QuestaoRow = {
  id: string;
  tipo: QuestaoTipo;
  enunciado: string;
  ordem: number;
  alternativas: { id: string; texto: string; ordem: number }[];
};

type TentativaRow = {
  id: string;
  numero: number;
  nota: number;
  aprovado: boolean;
  created_at: string;
};

type RespostaRow = {
  questao_id: string;
  alternativa_id: string | null;
  resposta_texto: string | null;
  correta: boolean | null;
};

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string }>;
}) {
  const user = await requireRole("aluno");
  const { id: cursoId, moduloId, aulaId } = await params;

  const supabase = await createClient();

  const temAcesso = await alunoTemAcessoAoCurso(supabase, user.id, cursoId);
  if (!temAcesso) {
    notFound();
  }

  const { data: aulaData } = await supabase
    .from("aulas")
    .select("id, titulo, modulo_id, modulos(id, numero, titulo, curso_id)")
    .eq("id", aulaId)
    .eq("modulo_id", moduloId)
    .single();

  const aula = aulaData as unknown as AulaRow | null;

  if (!aula || !aula.modulos || aula.modulos.curso_id !== cursoId) {
    notFound();
  }

  const { data: quizData } = await supabase
    .from("quizzes")
    .select("*")
    .eq("aula_id", aulaId)
    .maybeSingle();

  const quiz = quizData as Quiz | null;

  if (!quiz) {
    notFound();
  }

  const matriculaId = await getMatriculaIdAtivaParaCurso(supabase, user.id, cursoId);
  if (!matriculaId) {
    notFound();
  }

  const [{ data: questoesData, error: questoesError }, { data: tentativasData }] =
    await Promise.all([
      supabase
        .from("questoes")
        .select("id, tipo, enunciado, ordem, alternativas(id, texto, ordem)")
        .eq("quiz_id", quiz.id)
        .order("ordem")
        .order("ordem", { referencedTable: "alternativas" }),
      supabase
        .from("tentativas_quiz")
        .select("id, numero, nota, aprovado, created_at")
        .eq("quiz_id", quiz.id)
        .eq("matricula_id", matriculaId)
        .order("numero", { ascending: false }),
    ]);

  const questoes = (questoesData ?? []) as unknown as QuestaoRow[];
  const tentativas = (tentativasData ?? []) as TentativaRow[];
  const ultimaTentativa = tentativas[0] ?? null;
  const tentativasUsadas = tentativas.length;

  const podeTentar =
    !quiz.tentativas_limitadas || tentativasUsadas < (quiz.tentativas_maximas ?? 0);
  // Só revela o gabarito quando essa foi a última tentativa possível — evita
  // o aluno simplesmente decorar a resposta certa pra uma próxima tentativa,
  // conforme decidido. Com tentativas ilimitadas nunca revela (sempre existe
  // uma "próxima" hipotética).
  const revelarGabarito = quiz.tentativas_limitadas && !podeTentar;

  let respostasPorQuestao = new Map<string, RespostaRow>();
  let gabaritoPorQuestao = new Map<string, string>();

  if (ultimaTentativa) {
    const { data: respostasData } = await supabase
      .from("respostas_quiz")
      .select("questao_id, alternativa_id, resposta_texto, correta")
      .eq("tentativa_id", ultimaTentativa.id);
    respostasPorQuestao = new Map(
      ((respostasData ?? []) as RespostaRow[]).map((r) => [r.questao_id, r]),
    );

    if (revelarGabarito) {
      const questaoIdsObjetivas = questoes
        .filter((q) => q.tipo !== "dissertativa")
        .map((q) => q.id);
      if (questaoIdsObjetivas.length > 0) {
        const { data: gabaritoData } = await supabase
          .from("alternativas")
          .select("id, questao_id, correta")
          .in("questao_id", questaoIdsObjetivas)
          .eq("correta", true);
        gabaritoPorQuestao = new Map(
          ((gabaritoData ?? []) as { id: string; questao_id: string }[]).map((a) => [
            a.questao_id,
            a.id,
          ]),
        );
      }
    }
  }

  const submeterAction = submeterTentativaQuiz.bind(null, cursoId, moduloId, aulaId, quiz.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/aluno/cursos/${cursoId}/modulos/${moduloId}/aulas/${aulaId}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          {aula.titulo}
        </Button>
        <h1 className="text-2xl font-semibold">{quiz.titulo}</h1>
        {quiz.tentativas_limitadas && (
          <p className="text-muted-foreground text-sm">
            {tentativasUsadas} de {quiz.tentativas_maximas} tentativas utilizadas
          </p>
        )}
      </div>

      {ultimaTentativa && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Resultado da tentativa {ultimaTentativa.numero}</CardTitle>
              {quiz.nota_minima_ativa && (
                <Badge variant={ultimaTentativa.aprovado ? "default" : "destructive"}>
                  {ultimaTentativa.aprovado ? "Aprovado" : "Reprovado"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-2xl font-semibold">{ultimaTentativa.nota}%</p>

            <div className="flex flex-col gap-3">
              {questoes.map((questao, index) => {
                const resposta = respostasPorQuestao.get(questao.id);

                if (questao.tipo === "dissertativa") {
                  return (
                    <div key={questao.id} className="flex flex-col gap-1 border-t pt-3">
                      <p className="text-sm font-medium">
                        {index + 1}. {questao.enunciado}
                      </p>
                      <p className="text-muted-foreground text-sm">{resposta?.resposta_texto}</p>
                      <p className="text-muted-foreground text-xs">
                        Resposta dissertativa — aguardando correção do professor.
                      </p>
                    </div>
                  );
                }

                const alternativaEscolhida = questao.alternativas.find(
                  (a) => a.id === resposta?.alternativa_id,
                );
                const alternativaCorretaId = gabaritoPorQuestao.get(questao.id);
                const alternativaCorreta = questao.alternativas.find(
                  (a) => a.id === alternativaCorretaId,
                );

                return (
                  <div key={questao.id} className="flex flex-col gap-1 border-t pt-3">
                    <div className="flex items-start gap-2">
                      {resposta?.correta ? (
                        <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                      ) : (
                        <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                      )}
                      <p className="text-sm font-medium">
                        {index + 1}. {questao.enunciado}
                      </p>
                    </div>
                    <p className="text-muted-foreground pl-6 text-sm">
                      Sua resposta: {alternativaEscolhida?.texto ?? "—"}
                    </p>
                    {!resposta?.correta && alternativaCorreta && (
                      <p className="pl-6 text-sm">Resposta correta: {alternativaCorreta.texto}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {questoesError ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as questões deste quiz. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : podeTentar ? (
        <QuizAnswerForm
          action={submeterAction}
          questoes={questoes}
          submitLabel={tentativasUsadas > 0 ? "Tentar novamente" : "Enviar respostas"}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Você atingiu o limite de {quiz.tentativas_maximas} tentativas para este quiz.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
