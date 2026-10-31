import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TurmaForm } from "@/components/admin/turma-form";
import { updateTurma } from "@/app/admin/turmas/actions";
import type { Turma } from "@/lib/turmas/schema";

export default async function EditarTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: turmaData }, { data: cursos }] = await Promise.all([
    supabase.from("turmas").select("*, turma_cursos(curso_id, ordem)").eq("id", id).single(),
    // Sem filtro de status: o curso já vinculado pode ter sido desativado
    // depois da turma criada, e ele precisa continuar aparecendo aqui.
    supabase.from("cursos").select("id, nome, tipo").order("nome"),
  ]);
  const turma = turmaData as (Turma & { turma_cursos: { curso_id: string; ordem: number }[] }) | null;

  if (!turma) {
    notFound();
  }

  const cursoIdsVinculados =
    turma.turma_cursos.length > 0
      ? [...turma.turma_cursos].sort((a, b) => a.ordem - b.ordem).map((v) => v.curso_id)
      : [turma.curso_id];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar turma</h1>
        <p className="text-muted-foreground text-sm">{turma.nome}</p>
      </div>
      <TurmaForm
        action={updateTurma.bind(null, turma.id)}
        cursos={cursos ?? []}
        cursoIdsVinculados={cursoIdsVinculados}
        defaultValues={{
          nome: turma.nome,
          data_inicio: turma.data_inicio,
          data_fim: turma.data_fim,
          capacidade_maxima: turma.capacidade_maxima,
          status: turma.status,
          cadencia_dias_semana: turma.cadencia_dias_semana ?? [],
          horario_aula: turma.horario_aula?.slice(0, 5) ?? "",
          turno: turma.turno ?? undefined,
          local_sala: turma.local_sala ?? "",
          professor: turma.professor ?? "",
          horario_fim: turma.horario_fim ?? "",
          observacoes: turma.observacoes ?? "",
          telegram_chat_id: turma.telegram_chat_id ?? "",
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
