import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buscarModulosAulasCurso, getMatricula } from "@/app/admin/matriculas/actions";
import { MatriculaDetalhes } from "@/components/admin/matricula-detalhes";
import { HistoricoAlteracoesSection } from "@/components/admin/historico-alteracoes-section";

export default async function MatriculaDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const matricula = await getMatricula(id);

  if (!matricula) {
    notFound();
  }

  const cursoId = matricula.turmas?.cursos?.id;
  const supabase = await createClient();
  const [{ data: configuracoes }, modulosAulas] = await Promise.all([
    supabase
      .from("configuracoes")
      .select("escola_nome, escola_endereco, escola_telefone, termo_imagem_texto")
      .eq("id", true)
      .maybeSingle(),
    cursoId ? buscarModulosAulasCurso(cursoId) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <MatriculaDetalhes
        matricula={matricula}
        escola={{
          nome: configuracoes?.escola_nome ?? undefined,
          endereco: configuracoes?.escola_endereco ?? undefined,
          telefone: configuracoes?.escola_telefone ?? undefined,
          termoImagemTexto: configuracoes?.termo_imagem_texto ?? undefined,
        }}
        cursoModulosAulas={modulosAulas}
      />
      <HistoricoAlteracoesSection tabela="matriculas" registroId={id} />
    </div>
  );
}
