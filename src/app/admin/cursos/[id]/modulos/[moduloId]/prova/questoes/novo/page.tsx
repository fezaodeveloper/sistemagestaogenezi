import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { QuestaoProvaForm } from "@/components/admin/questao-prova-form";
import { createQuestaoProva } from "@/app/admin/cursos/[id]/modulos/[moduloId]/prova/questoes/actions";
import type { Prova } from "@/lib/provas/schema";

export default async function NovaQuestaoProvaPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId } = await params;

  const supabase = await createClient();
  const { data: provaData } = await supabase
    .from("provas")
    .select("*")
    .eq("modulo_id", moduloId)
    .maybeSingle();
  const prova = provaData as Prova | null;

  if (!prova) {
    notFound();
  }

  const { data: ultimaQuestao } = await supabase
    .from("questoes_prova")
    .select("ordem")
    .eq("prova_id", prova.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const proximaOrdem = (ultimaQuestao?.ordem ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova questão</h1>
        <p className="text-muted-foreground text-sm">{prova.titulo}</p>
      </div>
      <QuestaoProvaForm
        action={createQuestaoProva.bind(null, cursoId, moduloId, prova.id)}
        defaultValues={{ ordem: proximaOrdem }}
        submitLabel="Criar questão"
      />
    </div>
  );
}
