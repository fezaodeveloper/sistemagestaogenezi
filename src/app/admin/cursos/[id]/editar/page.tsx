import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CursoForm } from "@/components/admin/curso-form";
import { updateCurso } from "@/app/admin/cursos/actions";
import type { Curso } from "@/lib/cursos/schema";

export default async function EditarCursoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("cursos").select("*").eq("id", id).single();
  const curso = data as Curso | null;

  if (!curso) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar curso</h1>
        <p className="text-muted-foreground text-sm">{curso.nome}</p>
      </div>
      <CursoForm
        action={updateCurso.bind(null, curso.id)}
        defaultValues={{
          nome: curso.nome,
          descricao: curso.descricao ?? undefined,
          tipo: curso.tipo,
          status: curso.status,
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
