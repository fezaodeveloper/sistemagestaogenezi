import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPainelProfessor } from "@/lib/professor/panel";
import { ProfessorView } from "@/components/admin/professor-view";

export default async function ProfessorPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const cursos = await getPainelProfessor(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel do Professor</h1>
        <p className="text-muted-foreground text-sm">
          Cursos presenciais e híbridos ativos — materiais para exibir durante a aula (PDF e vídeo) e
          atalho para o chat com os alunos de cada turma.
        </p>
      </div>

      <ProfessorView cursos={cursos} />
    </div>
  );
}
