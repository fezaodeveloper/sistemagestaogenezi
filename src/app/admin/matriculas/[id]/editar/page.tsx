import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { buscarTurmasParaWizard, getMatricula } from "@/app/admin/matriculas/actions";
import { MatriculaEditForm } from "@/components/admin/matricula-edit-form";

export default async function EditarMatriculaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const matricula = await getMatricula(id);
  if (!matricula) notFound();

  // Turmas do curso atual, pro Select de turma já nascer preenchido.
  const cursoId = matricula.turmas?.cursos?.id;
  const turmasIniciais = cursoId ? await buscarTurmasParaWizard(cursoId) : [];

  return <MatriculaEditForm matricula={matricula} turmasIniciais={turmasIniciais} />;
}
