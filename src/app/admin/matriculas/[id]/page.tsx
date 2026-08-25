import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getMatricula } from "@/app/admin/matriculas/actions";
import { MatriculaDetalhes } from "@/components/admin/matricula-detalhes";

export default async function MatriculaDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const matricula = await getMatricula(id);

  if (!matricula) {
    notFound();
  }

  return <MatriculaDetalhes matricula={matricula} />;
}
