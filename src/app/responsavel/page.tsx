import { PortalResponsavelAuth } from "@/components/responsavel/portal-responsavel-auth";

// Server Component público — sem requireRole, sem sidebar/menu admin, sem id de aluno na URL:
// o responsável se identifica só pelo próprio CPF (ver PortalResponsavelAuth), não há nada pra
// buscar/validar aqui antes de renderizar.
export default function PortalResponsavelPage() {
  return <PortalResponsavelAuth />;
}
