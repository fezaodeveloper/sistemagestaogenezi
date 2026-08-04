import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AlunoCreateForm } from "@/components/admin/aluno-create-form";

export default async function NovoAlunoPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome")
    .in("status", ["planejada", "ativa"])
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo aluno</h1>
        <p className="text-muted-foreground text-sm">
          Cria a conta do aluno com senha temporária e grava os dados do cadastro.
        </p>
      </div>
      <AlunoCreateForm turmas={turmas ?? []} />
    </div>
  );
}
