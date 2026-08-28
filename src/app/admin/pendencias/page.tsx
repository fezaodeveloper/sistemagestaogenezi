import { requireRole } from "@/lib/auth/dal";
import { getPendencias } from "@/app/admin/pendencias/actions";
import { PendenciasView } from "@/components/admin/pendencias-view";

export default async function PendenciasPage() {
  await requireRole("admin");

  const pendencias = await getPendencias();

  return <PendenciasView pendencias={pendencias} />;
}
