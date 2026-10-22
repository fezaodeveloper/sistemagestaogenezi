import { redirect } from "next/navigation";

// Rota antiga (/responsavel/[alunoId], com id do aluno na URL) substituída por /responsavel
// (sem id — o responsável entra só com o próprio CPF, ver src/app/responsavel/page.tsx).
// Mantida como redirect pra qualquer link antigo já enviado (WhatsApp, etc.) continuar
// funcionando em vez de dar 404.
export default function PortalResponsavelLegacyRedirect() {
  redirect("/responsavel");
}
