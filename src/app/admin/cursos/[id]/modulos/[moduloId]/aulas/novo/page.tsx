import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AulaForm } from "@/components/admin/aula-form";
import { createAula } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/actions";
import type { Modulo } from "@/lib/modulos/schema";

export default async function NovaAulaPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("modulos")
    .select("*")
    .eq("id", moduloId)
    .eq("curso_id", cursoId)
    .single();
  const modulo = data as Modulo | null;

  if (!modulo) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova aula</h1>
        <p className="text-muted-foreground text-sm">{modulo.titulo}</p>
      </div>
      <AulaForm action={createAula.bind(null, cursoId, moduloId)} submitLabel="Criar aula" />
    </div>
  );
}
