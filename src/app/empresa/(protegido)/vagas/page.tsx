import { getCidadesAprovadas, getMinhasVagas } from "@/app/empresa/(protegido)/vagas/actions";
import { VagasView } from "@/components/empresa/vagas-view";

export default async function EmpresaVagasPage() {
  const [vagas, cidadesAprovadas] = await Promise.all([getMinhasVagas(), getCidadesAprovadas()]);

  return <VagasView vagasIniciais={vagas} recarregarAction={getMinhasVagas} cidadesAprovadas={cidadesAprovadas} />;
}
