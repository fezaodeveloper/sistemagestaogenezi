import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlunoEditForm } from "@/components/admin/aluno-edit-form";
import { MatriculasSection } from "@/components/admin/matriculas-section";
import type { AlunoWithRelations, Responsavel } from "@/lib/alunos/schema";
import type { MatriculaWithTurma } from "@/lib/matriculas/schema";

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [
    { data: alunoData },
    { data: responsavelData },
    { data: matriculasData },
    { data: turmasData },
  ] = await Promise.all([
    supabase.from("alunos").select("*, profiles!alunos_id_fkey(full_name)").eq("id", id).single(),
    supabase.from("responsaveis").select("*").eq("aluno_id", id).maybeSingle(),
    supabase
      .from("matriculas")
      .select("*, turmas(nome)")
      .eq("aluno_id", id)
      .order("created_at", { ascending: false }),
    // Só turmas que ainda fazem sentido pra receber uma matrícula nova —
    // não filtra na edição de uma matrícula já existente.
    supabase.from("turmas").select("id, nome").in("status", ["planejada", "ativa"]).order("nome"),
  ]);
  const aluno = alunoData as AlunoWithRelations | null;
  const responsavel = responsavelData as Responsavel | null;
  const matriculas = (matriculasData as MatriculaWithTurma[] | null) ?? [];

  if (!aluno) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar aluno</h1>
        <p className="text-muted-foreground text-sm">{aluno.profiles?.full_name ?? aluno.email}</p>
      </div>
      <AlunoEditForm
        id={aluno.id}
        defaultValues={{
          full_name: aluno.profiles?.full_name ?? "",
          cpf: aluno.cpf,
          telefone: aluno.telefone,
          endereco: aluno.endereco ?? "",
          data_nascimento: aluno.data_nascimento,
          responsavel_nome: responsavel?.nome,
          responsavel_cpf: responsavel?.cpf,
          responsavel_telefone: responsavel?.telefone,
        }}
      />
      <MatriculasSection
        alunoId={aluno.id}
        matriculas={matriculas}
        turmasDisponiveis={turmasData ?? []}
      />
    </div>
  );
}
