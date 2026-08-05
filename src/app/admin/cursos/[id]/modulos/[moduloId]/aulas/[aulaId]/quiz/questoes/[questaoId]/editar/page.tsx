import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { QuestaoForm } from "@/components/admin/questao-form";
import { updateQuestao } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/quiz/questoes/actions";
import type { Quiz } from "@/lib/quizzes/schema";
import type { QuestaoWithAlternativas } from "@/lib/questoes/schema";

export default async function EditarQuestaoPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string; questaoId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, aulaId, questaoId } = await params;

  const supabase = await createClient();
  const [{ data: quizData }, { data: questaoData }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("aula_id", aulaId).maybeSingle(),
    supabase
      .from("questoes")
      .select("*, alternativas(*)")
      .eq("id", questaoId)
      .order("ordem", { referencedTable: "alternativas" })
      .single(),
  ]);
  const quiz = quizData as Quiz | null;
  const questao = questaoData as unknown as QuestaoWithAlternativas | null;

  if (!quiz || !questao || questao.quiz_id !== quiz.id) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar questão</h1>
        <p className="text-muted-foreground text-sm">{quiz.titulo}</p>
      </div>
      <QuestaoForm
        action={updateQuestao.bind(null, cursoId, moduloId, aulaId, questao.id)}
        defaultValues={{
          tipo: questao.tipo,
          enunciado: questao.enunciado,
          ordem: questao.ordem,
          alternativas: questao.alternativas.map((a) => ({ texto: a.texto, correta: a.correta })),
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
