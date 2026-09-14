import { requireRole } from "@/lib/auth/dal";
import { listarCandidatosExternos } from "@/app/admin/conecta/candidatos/actions";
import { ConectaCandidatosView } from "@/components/admin/conecta-candidatos-view";

export default async function AdminConectaCandidatosPage() {
  await requireRole("admin");

  const resultado = await listarCandidatosExternos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidatos — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">Candidatos externos pagos, assinantes do portal de vagas.</p>
      </div>
      <ConectaCandidatosView resultadoInicial={resultado} />
    </div>
  );
}
