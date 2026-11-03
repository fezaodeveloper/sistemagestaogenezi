import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  TurmaDetalhes,
  type TurmaMatriculaAluno,
  type TurmaPresencaRow,
} from "@/components/admin/turma-detalhes";
import type { TurmaCursoVinculo, TurmaWithCurso } from "@/lib/turmas/schema";

export default async function TurmaDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: turmaData }, { data: matriculasData }, { data: presencasData }] =
    await Promise.all([
      supabase.from("turmas").select("*, cursos(nome), turma_cursos(curso_id, ordem, cursos(nome))").eq("id", id).single(),
      supabase
        .from("matriculas")
        .select("id, status, curso_id, alunos(full_name, email, telefone)")
        .eq("turma_id", id)
        .eq("status", "ativa")
        .order("created_at", { ascending: false }),
      // Todas as presenças da turma (qualquer status), pra calcular a
      // frequência de cada aluno na aba "Relatório de frequência" — mesmo
      // truque de matriculas!inner(turma_id) usado em presencas/page.tsx
      // pra filtrar por turma sem uma FK direta turma_id em presencas.
      supabase
        .from("presencas")
        .select("matricula_id, status, matriculas!inner(turma_id)")
        .eq("matriculas.turma_id", id),
    ]);
  const turma = turmaData as (TurmaWithCurso & { turma_cursos: TurmaCursoVinculo[] }) | null;

  if (!turma) {
    notFound();
  }

  const matriculas = (matriculasData as TurmaMatriculaAluno[] | null) ?? [];

  // TAREFA fix cursos por turma (PARTE 4) — resolve em lote o nome do curso que cada aluno
  // escolheu (matriculas.curso_id), só precisa quando a turma oferece 2+ cursos (ver
  // agruparAlunosPorCurso em turma-detalhes.tsx). Consulta separada, não embed: mesmo motivo
  // documentado em src/app/aluno/page.tsx (matriculas tem duas FKs pra cursos).
  const idsCursosEscolhidos = [...new Set(matriculas.map((m) => m.curso_id).filter((cid): cid is string => !!cid))];
  const { data: cursosEscolhidosData } =
    idsCursosEscolhidos.length > 0 ? await supabase.from("cursos").select("id, nome").in("id", idsCursosEscolhidos) : { data: [] };
  const nomesCursosEscolhidos = Object.fromEntries((cursosEscolhidosData ?? []).map((c) => [c.id as string, c.nome as string]));

  return (
    <TurmaDetalhes
      turma={turma}
      matriculas={matriculas}
      presencas={(presencasData as unknown as TurmaPresencaRow[] | null) ?? []}
      nomesCursosEscolhidos={nomesCursosEscolhidos}
    />
  );
}
