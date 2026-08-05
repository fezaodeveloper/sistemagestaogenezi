import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { QuestaoForm } from "@/components/admin/questao-form";
import { createQuestao } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/quiz/questoes/actions";
import type { Quiz } from "@/lib/quizzes/schema";

export default async function NovaQuestaoPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, aulaId } = await params;

  const supabase = await createClient();
  const { data: quizData } = await supabase
    .from("quizzes")
    .select("*")
    .eq("aula_id", aulaId)
    .maybeSingle();
  const quiz = quizData as Quiz | null;

  if (!quiz) {
    notFound();
  }

  const { data: ultimaQuestao } = await supabase
    .from("questoes")
    .select("ordem")
    .eq("quiz_id", quiz.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const proximaOrdem = (ultimaQuestao?.ordem ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova questão</h1>
        <p className="text-muted-foreground text-sm">{quiz.titulo}</p>
      </div>
      <QuestaoForm
        action={createQuestao.bind(null, cursoId, moduloId, aulaId, quiz.id)}
        defaultValues={{ ordem: proximaOrdem }}
        submitLabel="Criar questão"
      />
    </div>
  );
}
