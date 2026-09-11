import { requireRole } from "@/lib/auth/dal";
import { getEmpresasConecta } from "@/app/admin/conecta/actions";
import { ConectaView } from "@/components/admin/conecta-view";

export default async function AdminConectaPage() {
  await requireRole("admin");

  const resultado = await getEmpresasConecta();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Empresas — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">
          Empresas parceiras cadastradas no portal de vagas.
        </p>
      </div>
      <ConectaView resultadoInicial={resultado} />
    </div>
  );
}
