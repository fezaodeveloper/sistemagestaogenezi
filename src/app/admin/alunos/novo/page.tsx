import { requireRole } from "@/lib/auth/dal";
import { AlunoCreateForm } from "@/components/admin/aluno-create-form";

export default async function NovoAlunoPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo aluno</h1>
        <p className="text-muted-foreground text-sm">
          Cria a conta do aluno com senha temporária e grava os dados do cadastro. A matrícula em
          turmas é feita depois, na tela do aluno.
        </p>
      </div>
      <AlunoCreateForm />
    </div>
  );
}
