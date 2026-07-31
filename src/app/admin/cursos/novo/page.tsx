import { requireRole } from "@/lib/auth/dal";
import { CursoForm } from "@/components/admin/curso-form";
import { createCurso } from "@/app/admin/cursos/actions";

export default async function NovoCursoPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo curso</h1>
        <p className="text-muted-foreground text-sm">Cadastre um novo curso.</p>
      </div>
      <CursoForm action={createCurso} submitLabel="Criar curso" />
    </div>
  );
}
