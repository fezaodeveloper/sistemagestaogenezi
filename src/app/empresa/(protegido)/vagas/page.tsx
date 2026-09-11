import { getMinhasVagas } from "@/app/empresa/(protegido)/vagas/actions";
import { VagasView } from "@/components/empresa/vagas-view";

export default async function EmpresaVagasPage() {
  const vagas = await getMinhasVagas();

  return <VagasView vagasIniciais={vagas} recarregarAction={getMinhasVagas} />;
}
