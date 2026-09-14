import { requireRole } from "@/lib/auth/dal";
import { getCidadesAdmin } from "@/app/admin/conecta/cidades/actions";
import { ConectaCidadesView } from "@/components/admin/conecta-cidades-view";

export default async function AdminConectaCidadesPage() {
  await requireRole("admin");

  const cidades = await getCidadesAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cidades aprovadas para vagas</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as cidades onde empresas podem cadastrar vagas. Expanda conforme o interesse das empresas
          crescer.
        </p>
      </div>
      <ConectaCidadesView cidadesIniciais={cidades} />
    </div>
  );
}
