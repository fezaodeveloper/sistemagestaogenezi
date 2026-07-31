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
    supabase.from("turmas").select("*").eq("id", id).single(),
    // Sem filtro de status: o curso já vinculado pode ter sido desativado
    // depois da turma criada, e ele precisa continuar aparecendo aqui.
    supabase.from("cursos").select("id, nome").order("nome"),
  ]);
  const turma = turmaData as Turma | null;

  if (!turma) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar turma</h1>
        <p className="text-muted-foreground text-sm">{turma.nome}</p>
      </div>
      <TurmaForm
        action={updateTurma.bind(null, turma.id)}
        cursos={cursos ?? []}
        defaultValues={{
          curso_id: turma.curso_id,
          nome: turma.nome,
          data_inicio: turma.data_inicio,
          data_fim: turma.data_fim,
          capacidade_maxima: turma.capacidade_maxima,
          status: turma.status,
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
