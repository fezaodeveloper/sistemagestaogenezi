import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AulaForm } from "@/components/admin/aula-form";
import { createAula } from "@/app/admin/cursos/[id]/aulas/actions";
import type { Curso } from "@/lib/cursos/schema";

export default async function NovaAulaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id: cursoId } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("cursos").select("*").eq("id", cursoId).single();
  const curso = data as Curso | null;

  if (!curso) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova aula</h1>
        <p className="text-muted-foreground text-sm">{curso.nome}</p>
      </div>
      <AulaForm action={createAula.bind(null, cursoId)} submitLabel="Criar aula" />
    </div>
  );
}
