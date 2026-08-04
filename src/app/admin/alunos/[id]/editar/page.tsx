import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlunoEditForm } from "@/components/admin/aluno-edit-form";
import type { AlunoWithRelations, Responsavel } from "@/lib/alunos/schema";

export default async function EditarAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: alunoData }, { data: responsavelData }] = await Promise.all([
    supabase.from("alunos").select("*, profiles!alunos_id_fkey(full_name)").eq("id", id).single(),
    supabase.from("responsaveis").select("*").eq("aluno_id", id).maybeSingle(),
  ]);
  const aluno = alunoData as AlunoWithRelations | null;
  const responsavel = responsavelData as Responsavel | null;

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
      {/* Seção de matrículas entra na parte 4 (telas) da Fase 4. */}
    </div>
  );
}
