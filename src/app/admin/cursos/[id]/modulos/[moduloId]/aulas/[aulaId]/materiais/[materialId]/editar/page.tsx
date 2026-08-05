import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { MaterialForm } from "@/components/admin/material-form";
import { updateMaterial } from "@/app/admin/cursos/[id]/modulos/[moduloId]/aulas/[aulaId]/materiais/actions";
import type { Aula } from "@/lib/aulas/schema";
import type { Material } from "@/lib/materiais/schema";

export default async function EditarMaterialPage({
  params,
}: {
  params: Promise<{ id: string; moduloId: string; aulaId: string; materialId: string }>;
}) {
  await requireRole("admin");
  const { id: cursoId, moduloId, aulaId, materialId } = await params;

  const supabase = await createClient();
  const [{ data: aulaData }, { data: materialData }] = await Promise.all([
    supabase.from("aulas").select("*").eq("id", aulaId).eq("modulo_id", moduloId).single(),
    supabase.from("materiais").select("*").eq("id", materialId).eq("aula_id", aulaId).single(),
  ]);
  const aula = aulaData as Aula | null;
  const material = materialData as Material | null;

  if (!aula || !material) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar material</h1>
        <p className="text-muted-foreground text-sm">
          {aula.titulo} · {material.titulo}
        </p>
      </div>
      <MaterialForm
        action={updateMaterial.bind(null, cursoId, moduloId, aulaId, material.id, {
          tipo: material.tipo,
          url: material.url,
        })}
        defaultValues={{
          tipo: material.tipo,
          titulo: material.titulo,
          ordem: material.ordem,
          url: material.tipo === "pdf" ? undefined : material.url,
        }}
        submitLabel="Salvar alterações"
        isEdit
      />
    </div>
  );
}
