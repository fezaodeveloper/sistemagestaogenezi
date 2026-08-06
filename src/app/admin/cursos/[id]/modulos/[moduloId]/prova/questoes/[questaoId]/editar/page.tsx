import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { QuestaoProvaForm } from "@/components/admin/questao-prova-form";
import { updateQuestaoProva } from "@/app/admin/cursos/[id]/modulos/[moduloId]/prova/questoes/actions";
import type { Prova } from "@/lib/provas/schema";
import type { QuestaoProvaWithAlternativas } from "@/lib/questoes-prova/schema";

export default async function EditarQuestaoProvaPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; questaoId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, questaoId } = await params;

  const supabase = await createClient();
  const [{ data: provaData }, { data: questaoData }] = await Promise.all([
    supabase.from("provas").select("*").eq("modulo_id", moduloId).maybeSingle(),
    supabase
      .from("questoes_prova")
      .select("*, alternativas:alternativas_prova(*)")
      .eq("id", questaoId)
      .order("ordem", { referencedTable: "alternativas_prova" })
      .single(),
  ]);
  const prova = provaData as Prova | null;
  const questao = questaoData as unknown as QuestaoProvaWithAlternativas | null;

  if (!prova || !questao || questao.prova_id !== prova.id) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar questão</h1>
        <p className="text-muted-foreground text-sm">{prova.titulo}</p>
      </div>
      <QuestaoProvaForm
        action={updateQuestaoProva.bind(null, cursoId, moduloId, questao.id)}
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
