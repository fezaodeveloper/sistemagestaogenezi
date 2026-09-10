import { requireRole } from "@/lib/auth/dal";
import { getAcessosRemotos } from "@/app/admin/acesso-remoto/actions";
import { AcessoRemotoView } from "@/components/admin/acesso-remoto-view";

export default async function AcessoRemotoPage() {
  await requireRole("admin");

  const acessos = await getAcessosRemotos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Acesso Remoto</h1>
        <p className="text-muted-foreground text-sm">
          Credenciais de acesso remoto aos computadores da escola.
        </p>
      </div>
      <AcessoRemotoView acessosIniciais={acessos} />
    </div>
  );
}
