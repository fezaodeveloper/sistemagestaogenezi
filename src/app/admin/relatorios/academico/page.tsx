import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { RelatorioAcademicoView, type TurmaOpcao } from "@/components/admin/relatorio-academico-view";

export default async function RelatorioAcademicoPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("turmas")
    .select("id, nome, cursos(nome)")
    .eq("status", "ativa")
    .order("nome");

  const turmas = (data as unknown as TurmaOpcao[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatório Acadêmico</h1>
        <p className="text-muted-foreground text-sm">
          Frequência e desempenho dos alunos por turma e período.
        </p>
      </div>
      <RelatorioAcademicoView turmas={turmas} />
    </div>
  );
}
