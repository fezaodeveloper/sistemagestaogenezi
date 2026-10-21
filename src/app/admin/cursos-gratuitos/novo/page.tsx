import { requireRole } from "@/lib/auth/dal";
import { CursoGratuitoForm } from "@/components/admin/curso-gratuito-form";
import { criarCursoGratuito } from "@/app/admin/cursos-gratuitos/actions";

export default async function NovoCursoGratuitoPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo curso gratuito</h1>
        <p className="text-muted-foreground text-sm">
          Cadastre um curso oferecido gratuitamente em uma plataforma externa.
        </p>
      </div>
      <CursoGratuitoForm action={criarCursoGratuito} submitLabel="Criar curso gratuito" />
    </div>
  );
}
