import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  TurmaDetalhes,
  type TurmaMatriculaAluno,
  type TurmaPresencaRow,
} from "@/components/admin/turma-detalhes";
import type { TurmaWithCurso } from "@/lib/turmas/schema";

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
      supabase.from("turmas").select("*, cursos(nome)").eq("id", id).single(),
      supabase
        .from("matriculas")
        .select("id, status, alunos(full_name, email, telefone)")
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
  const turma = turmaData as TurmaWithCurso | null;

  if (!turma) {
    notFound();
  }

  return (
    <TurmaDetalhes
      turma={turma}
      matriculas={(matriculasData as TurmaMatriculaAluno[] | null) ?? []}
      presencas={(presencasData as unknown as TurmaPresencaRow[] | null) ?? []}
    />
  );
}
