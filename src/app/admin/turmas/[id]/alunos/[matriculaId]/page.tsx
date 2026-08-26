import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  HistoricoPresencas,
  type AulaOpcao,
  type MatriculaHistoricoAluno,
  type PresencaHistoricoRow,
} from "@/components/admin/historico-presencas";

type MatriculaHistorico = {
  id: string;
  turma_id: string;
  alunos: MatriculaHistoricoAluno | null;
  turmas: { nome: string; curso_id: string; cursos: { nome: string } | null } | null;
};

export default async function HistoricoPresencasPage({
  params,
}: {
  params: Promise<{ id: string; matriculaId: string }>;
}) {
  await requireRole("admin");
  const { id: turmaId, matriculaId } = await params;

  const supabase = await createClient();
  const { data: matriculaData } = await supabase
    .from("matriculas")
    .select(
      "id, turma_id, alunos(full_name, email, cpf, telefone), turmas(nome, curso_id, cursos(nome))",
    )
    .eq("id", matriculaId)
    .single();
  const matricula = matriculaData as MatriculaHistorico | null;

  // A matrícula precisa mesmo pertencer a essa turma — protege contra um
  // matriculaId válido usado com um id de turma incompatível na URL.
  if (!matricula || matricula.turma_id !== turmaId) {
    notFound();
  }

  const [{ data: presencasData }, { data: aulasData }] = await Promise.all([
    supabase
      .from("presencas")
      .select(
        "id, data, status, data_reposicao, justificativa, aula_id, aulas(titulo, modulos(titulo))",
      )
      .eq("matricula_id", matriculaId)
      .order("data", { ascending: false }),
    // Mesmo padrão de registrar/page.tsx: busca todas as aulas + módulo pra
    // filtrar em memória pelas que pertencem ao curso desta turma.
    supabase.from("aulas").select("id, titulo, modulos(curso_id)").order("numero"),
  ]);

  const aulasDoCurso = (
    (aulasData ?? []) as unknown as {
      id: string;
      titulo: string;
      modulos: { curso_id: string } | null;
    }[]
  )
    .filter((aula) => aula.modulos?.curso_id === matricula.turmas?.curso_id)
    .map((aula): AulaOpcao => ({ id: aula.id, titulo: aula.titulo }));

  return (
    <HistoricoPresencas
      matriculaId={matriculaId}
      turmaId={turmaId}
      aluno={matricula.alunos}
      turmaNome={matricula.turmas?.nome ?? "—"}
      cursoNome={matricula.turmas?.cursos?.nome ?? "—"}
      presencas={(presencasData as unknown as PresencaHistoricoRow[] | null) ?? []}
      aulasDisponiveis={aulasDoCurso}
    />
  );
}
