import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";

// A primeira (e por ora única) seção. Novas abas viram subrotas irmãs de "login".
export default async function PortalAlunoPage() {
  await requireRole("admin");
  redirect("/admin/configuracoes/portal-aluno/login");
}
