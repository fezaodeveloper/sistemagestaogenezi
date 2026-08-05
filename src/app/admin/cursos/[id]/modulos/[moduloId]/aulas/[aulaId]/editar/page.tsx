import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AulaForm } from "@/components/admin/aula-form";
import { updateAula } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/actions";
import type { Aula } from "@/lib/aulas/schema";
import type { Modulo } from "@/lib/modulos/schema";

export default async function EditarAulaPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, aulaId } = await params;

  const supabase = await createClient();
  const [{ data: moduloData }, { data: aulaData }] = await Promise.all([
    supabase.from("modulos").select("*").eq("id", moduloId).eq("curso_id", cursoId).single(),
    supabase.from("aulas").select("*").eq("id", aulaId).eq("modulo_id", moduloId).single(),
  ]);
  const modulo = moduloData as Modulo | null;
  const aula = aulaData as Aula | null;

  if (!modulo || !aula) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar aula</h1>
        <p className="text-muted-foreground text-sm">
          {modulo.titulo} · {aula.titulo}
        </p>
      </div>
      <AulaForm
        action={updateAula.bind(null, cursoId, moduloId, aula.id)}
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
