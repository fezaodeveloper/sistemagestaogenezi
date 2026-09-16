import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { MatriculaWizard } from "@/components/admin/matricula-wizard";

export default async function NovaMatriculaPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: configuracoes } = await supabase
    .from("configuracoes")
    .select("escola_nome, escola_endereco, escola_telefone, termo_imagem_texto")
    .eq("id", true)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova Matrícula</h1>
        <p className="text-muted-foreground text-sm">
          Preencha as etapas abaixo para matricular um aluno em uma turma.
        </p>
      </div>
      <MatriculaWizard
        escola={{
          nome: configuracoes?.escola_nome ?? undefined,
          endereco: configuracoes?.escola_endereco ?? undefined,
          telefone: configuracoes?.escola_telefone ?? undefined,
          termoImagemTexto: configuracoes?.termo_imagem_texto ?? undefined,
        }}
      />
    </div>
  );
}
