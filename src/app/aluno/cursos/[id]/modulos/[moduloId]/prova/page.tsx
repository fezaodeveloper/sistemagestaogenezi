import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { alunoTemAcessoAoCurso, getMatriculaIdAtivaParaCurso } from "@/lib/matriculas/access";
import type { Prova } from "@/lib/provas/schema";
import { ProvaAnswerForm } from "@/components/aluno/prova-answer-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { submeterTentativaProva } from "./actions";

type ModuloRow = { id: string; numero: number; titulo: string; curso_id: string };

type QuestaoTipo = "multipla_escolha" | "verdadeiro_falso" | "dissertativa";

type QuestaoRow = {
  id: string;
  tipo: QuestaoTipo;
  enunciado: string;
  ordem: number;
  alternativas_prova: { id: string; texto: string; ordem: number }[];
};

type TentativaRow = {
  id: string;
  numero: number;
  nota: number;
  aprovado: boolean;
  created_at: string;
};

type RespostaRow = {
  questao_prova_id: string;
  alternativa_prova_id: string | null;
  resposta_texto: string | null;
  correta: boolean | null;
};

export default async function ProvaPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string }>;
}) {
  const user = await requireRole("aluno");
  const { id: cursoId, moduloId } = await params;

  const supabase = await createClient();

  const temAcesso = await alunoTemAcessoAoCurso(supabase, user.id, cursoId);
  if (!temAcesso) {
    notFound();
  }

  const { data: moduloData } = await supabase
    .from("modulos")
    .select("id, numero, titulo, curso_id")
    .eq("id", moduloId)
    .single();

  const modulo = moduloData as ModuloRow | null;

  if (!modulo || modulo.curso_id !== cursoId) {
    notFound();
  }

  const { data: provaData } = await supabase
    .from("provas")
    .select("*")
    .eq("modulo_id", moduloId)
    .maybeSingle();

  const prova = provaData as Prova | null;

  if (!prova) {
    notFound();
  }

  const matriculaId = await getMatriculaIdAtivaParaCurso(supabase, user.id, cursoId);
  if (!matriculaId) {
    notFound();
  }

  const [{ data: questoesData, error: questoesError }, { data: tentativasData }] =
    await Promise.all([
      supabase
        .from("questoes_prova")
        .select("id, tipo, enunciado, ordem, alternativas_prova(id, texto, ordem)")
        .eq("prova_id", prova.id)
        .order("ordem")
        .order("ordem", { referencedTable: "alternativas_prova" }),
      supabase
        .from("tentativas_prova")
        .select("id, numero, nota, aprovado, created_at")
        .eq("prova_id", prova.id)
        .eq("matricula_id", matriculaId)
        .order("numero", { ascending: false }),
    ]);

  const questoes = (questoesData ?? []) as unknown as QuestaoRow[];
  const tentativas = (tentativasData ?? []) as TentativaRow[];
  const ultimaTentativa = tentativas[0] ?? null;
  const tentativasUsadas = tentativas.length;

  const podeTentar =
    !prova.tentativas_limitadas || tentativasUsadas < (prova.tentativas_maximas ?? 0);
  // Mesma regra do quiz: só revela o gabarito quando essa foi a última
  // tentativa possível.
  const revelarGabarito = prova.tentativas_limitadas && !podeTentar;

  let respostasPorQuestao = new Map<string, RespostaRow>();
  let gabaritoPorQuestao = new Map<string, string>();

  if (ultimaTentativa) {
    const { data: respostasData } = await supabase
      .from("respostas_prova")
      .select("questao_prova_id, alternativa_prova_id, resposta_texto, correta")
      .eq("tentativa_id", ultimaTentativa.id);
    respostasPorQuestao = new Map(
      ((respostasData ?? []) as RespostaRow[]).map((r) => [r.questao_prova_id, r]),
    );

    if (revelarGabarito) {
      const questaoIdsObjetivas = questoes
        .filter((q) => q.tipo !== "dissertativa")
        .map((q) => q.id);
      if (questaoIdsObjetivas.length > 0) {
        const { data: gabaritoData } = await supabase
          .from("alternativas_prova")
          .select("id, questao_prova_id, correta")
          .in("questao_prova_id", questaoIdsObjetivas)
          .eq("correta", true);
        gabaritoPorQuestao = new Map(
          ((gabaritoData ?? []) as { id: string; questao_prova_id: string }[]).map((a) => [
            a.questao_prova_id,
            a.id,
          ]),
        );
      }
    }
  }

  const submeterAction = submeterTentativaProva.bind(null, cursoId, moduloId, prova.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Button
          render={<Link href={`/aluno/cursos/${cursoId}/modulos/${moduloId}`} />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft />
          Módulo {modulo.numero} — {modulo.titulo}
        </Button>
        <h1 className="text-2xl font-semibold">{prova.titulo}</h1>
        {prova.tentativas_limitadas && (
          <p className="text-muted-foreground text-sm">
            {tentativasUsadas} de {prova.tentativas_maximas} tentativas utilizadas
          </p>
        )}
      </div>

      {ultimaTentativa && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Resultado da tentativa {ultimaTentativa.numero}</CardTitle>
              {prova.nota_minima_ativa && (
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

                const alternativaEscolhida = questao.alternativas_prova.find(
                  (a) => a.id === resposta?.alternativa_prova_id,
                );
                const alternativaCorretaId = gabaritoPorQuestao.get(questao.id);
                const alternativaCorreta = questao.alternativas_prova.find(
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
            Não foi possível carregar as questões desta prova. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : podeTentar ? (
        <ProvaAnswerForm
          action={submeterAction}
          questoes={questoes.map((q) => ({
            id: q.id,
            tipo: q.tipo,
            enunciado: q.enunciado,
            ordem: q.ordem,
            alternativas: q.alternativas_prova,
          }))}
          submitLabel={tentativasUsadas > 0 ? "Tentar novamente" : "Enviar respostas"}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Você atingiu o limite de {prova.tentativas_maximas} tentativas para esta prova.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
