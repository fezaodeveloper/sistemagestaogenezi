import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CursoGratuitoForm } from "@/components/admin/curso-gratuito-form";
import { atualizarCursoGratuito } from "@/app/admin/cursos-gratuitos/actions";
import type { CursoGratuitoFormValues } from "@/lib/cursos/schema";

export default async function EditarCursoGratuitoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const { data: curso } = await supabase
    .from("cursos")
    .select("nome, descricao, url_plataforma_externa, carga_horaria, foto_url, foto_path, status")
    .eq("id", id)
    .eq("gratuito", true)
    .maybeSingle();

  if (!curso) notFound();

  const defaultValues: Partial<CursoGratuitoFormValues> = {
    nome: curso.nome,
    descricao: curso.descricao ?? undefined,
    url_plataforma_externa: curso.url_plataforma_externa ?? "",
    carga_horaria: curso.carga_horaria ?? undefined,
    status: curso.status,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar curso gratuito</h1>
        <p className="text-muted-foreground text-sm">{curso.nome}</p>
      </div>
      <CursoGratuitoForm
        action={atualizarCursoGratuito.bind(null, id, curso.foto_path)}
        defaultValues={defaultValues}
        submitLabel="Salvar alterações"
        cursoId={id}
        fotoAtualUrl={curso.foto_url}
      />
    </div>
  );
}
