import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { MaterialForm } from "@/components/admin/material-form";
import { createMaterial } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/materiais/actions";
import type { Aula } from "@/lib/aulas/schema";

export default async function NovoMaterialPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, aulaId } = await params;

  const supabase = await createClient();
  const [{ data: aulaData }, { data: ultimoMaterial }] = await Promise.all([
    supabase.from("aulas").select("*").eq("id", aulaId).eq("modulo_id", moduloId).single(),
    supabase
      .from("materiais")
      .select("ordem")
      .eq("aula_id", aulaId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const aula = aulaData as Aula | null;

  if (!aula) {
    notFound();
  }

  const proximaOrdem = (ultimoMaterial?.ordem ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo material</h1>
        <p className="text-muted-foreground text-sm">{aula.titulo}</p>
      </div>
      <MaterialForm
        action={createMaterial.bind(null, cursoId, moduloId, aulaId)}
        defaultValues={{ ordem: proximaOrdem }}
        submitLabel="Criar material"
      />
    </div>
  );
}
