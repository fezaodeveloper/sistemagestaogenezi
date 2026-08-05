import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ModuloForm } from "@/components/admin/modulo-form";
import { updateModulo } from "@/app/admin/cursos/[id]/modulos/actions";
import type { Modulo } from "@/lib/modulos/schema";

export default async function EditarModuloPage({
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
        <h1 className="text-2xl font-semibold">Editar módulo</h1>
        <p className="text-muted-foreground text-sm">{modulo.titulo}</p>
      </div>
      <ModuloForm
        action={updateModulo.bind(null, cursoId, modulo.id)}
        defaultValues={{
          numero: modulo.numero,
          titulo: modulo.titulo,
          descricao: modulo.descricao ?? undefined,
        }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
