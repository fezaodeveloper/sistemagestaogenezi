import { requireRole } from "@/lib/auth/dal";

export default async function NovaMatriculaPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova Matrícula</h1>
        <p className="text-muted-foreground text-sm">
          Wizard de matrícula em construção — em breve disponível.
        </p>
      </div>
    </div>
  );
}
