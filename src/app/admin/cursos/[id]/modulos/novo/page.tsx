import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ModuloForm } from "@/components/admin/modulo-form";
import { createModulo } from "@/app/admin/cursos/[id]/modulos/actions";
import type { Curso } from "@/lib/cursos/schema";

export default async function NovoModuloPage({ params }: { params: Promise<{ id: string }> }) {
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
        <h1 className="text-2xl font-semibold">Novo módulo</h1>
        <p className="text-muted-foreground text-sm">{curso.nome}</p>
      </div>
      <ModuloForm action={createModulo.bind(null, cursoId)} submitLabel="Criar módulo" />
    </div>
  );
}
