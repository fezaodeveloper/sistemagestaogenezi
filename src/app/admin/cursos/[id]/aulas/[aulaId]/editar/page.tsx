import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AulaForm } from "@/components/admin/aula-form";
import { updateAula } from "@/app/admin/cursos/[id]/aulas/actions";
import type { Aula } from "@/lib/aulas/schema";
import type { Curso } from "@/lib/cursos/schema";

export default async function EditarAulaPage({
  params,
}: {
  params: Promise<{ id: string; aulaId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, aulaId } = await params;

  const supabase = await createClient();
  const [{ data: cursoData }, { data: aulaData }] = await Promise.all([
    supabase.from("cursos").select("*").eq("id", cursoId).single(),
    supabase.from("aulas").select("*").eq("id", aulaId).eq("curso_id", cursoId).single(),
  ]);
  const curso = cursoData as Curso | null;
  const aula = aulaData as Aula | null;

  if (!curso || !aula) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar aula</h1>
        <p className="text-muted-foreground text-sm">
          {curso.nome} · {aula.titulo}
        </p>
      </div>
      <AulaForm
        action={updateAula.bind(null, cursoId, aula.id)}
        defaultValues={{
          numero: aula.numero,
          titulo: aula.titulo,
          conteudo: aula.conteudo ?? undefined,
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
