import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getMatricula } from "@/app/admin/matriculas/actions";
import { MatriculaDetalhes } from "@/components/admin/matricula-detalhes";
import { HistoricoAlteracoesSection } from "@/components/admin/historico-alteracoes-section";

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

  return (
    <div className="flex flex-col gap-6">
      <MatriculaDetalhes matricula={matricula} />
      <HistoricoAlteracoesSection tabela="matriculas" registroId={id} />
    </div>
  );
}
