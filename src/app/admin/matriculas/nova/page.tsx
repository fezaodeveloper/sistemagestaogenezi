import { requireRole } from "@/lib/auth/dal";
import { MatriculaWizard } from "@/components/admin/matricula-wizard";
import { getAlunosParaMatricula, getCursosParaMatricula } from "@/app/admin/matriculas/actions";

export default async function NovaMatriculaPage() {
  await requireRole("admin");

  const [alunos, cursos] = await Promise.all([
    getAlunosParaMatricula(),
    getCursosParaMatricula(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova Matrícula</h1>
        <p className="text-muted-foreground text-sm">
          Preencha as etapas abaixo para matricular um aluno em uma turma.
        </p>
      </div>
      <MatriculaWizard alunos={alunos} cursos={cursos} />
    </div>
  );
}
