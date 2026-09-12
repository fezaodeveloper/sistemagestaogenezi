import { requireEmpresa } from "@/lib/auth/dal";
import { getCandidatosDisponiveis } from "@/app/empresa/(protegido)/candidatos/actions";
import { CandidatosView } from "@/components/empresa/candidatos-view";

export default async function EmpresaCandidatosPage() {
  await requireEmpresa();

  const candidatos = await getCandidatosDisponiveis();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Candidatos</h1>
        <p className="text-muted-foreground text-sm">
          Candidatos com perfil visível na Gênezi Conecta.
        </p>
      </div>
      <CandidatosView candidatosIniciais={candidatos} />
    </div>
  );
}
