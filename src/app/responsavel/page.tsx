import { getConfigEscolaPublicaGlobal } from "@/app/responsavel/actions";
import { PortalResponsavelAuth } from "@/components/responsavel/portal-responsavel-auth";

// Server Component público — sem requireRole, sem sidebar/menu admin, sem id de aluno na URL:
// o responsável se identifica só pelo próprio CPF (ver PortalResponsavelAuth), não há nada de
// aluno pra buscar/validar aqui antes de renderizar. Só busca nome/logo da escola (dado público,
// sem relação com nenhum aluno) pra já exibir na tela de CPF, antes do responsável se identificar.
export default async function PortalResponsavelPage() {
  const escola = await getConfigEscolaPublicaGlobal();

  return <PortalResponsavelAuth escolaNome={escola.nome} escolaLogoUrl={escola.logoUrl} />;
}
