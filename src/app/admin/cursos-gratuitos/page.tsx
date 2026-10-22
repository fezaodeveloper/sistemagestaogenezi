import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CursosGratuitosTable } from "@/components/admin/cursos-gratuitos-table";

export default async function CursosGratuitosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data: cursos, error }, { data: matriculasBonus }, { data: vinculosManuais }] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, nome, descricao, url_plataforma_externa, carga_horaria, foto_url, status")
      .eq("gratuito", true)
      .order("nome"),
    // Inscritos = duas fontes combinadas: matriculas.curso_bonus_id (bônus de uma matrícula
    // paga, ver commit a87616d: o bônus nunca passa por turma_id) e aluno_cursos_gratuitos
    // (atribuição manual — ver migration 20261022150000). Busca todas de uma vez e conta em
    // memória (volume baixo: matrículas/vínculos de uma escola) em vez de uma query por curso.
    supabase.from("matriculas").select("aluno_id, curso_bonus_id").not("curso_bonus_id", "is", null),
    supabase.from("aluno_cursos_gratuitos").select("aluno_id, curso_id"),
  ]);

  // Mapa curso -> conjunto de alunos (não soma direto): um aluno com as duas formas de vínculo
  // pro mesmo curso conta só 1 vez, mesmo critério de getAlunosInscritosCursoGratuito.
  const alunosPorCurso = new Map<string, Set<string>>();
  for (const linha of matriculasBonus ?? []) {
    const cursoBonusId = linha.curso_bonus_id as string;
    if (!alunosPorCurso.has(cursoBonusId)) alunosPorCurso.set(cursoBonusId, new Set());
    alunosPorCurso.get(cursoBonusId)!.add(linha.aluno_id);
  }
  for (const linha of vinculosManuais ?? []) {
    if (!alunosPorCurso.has(linha.curso_id)) alunosPorCurso.set(linha.curso_id, new Set());
    alunosPorCurso.get(linha.curso_id)!.add(linha.aluno_id);
  }

  const inscritosPorCurso = new Map<string, number>();
  const todosAlunosInscritos = new Set<string>();
  for (const [cursoId, alunos] of alunosPorCurso) {
    inscritosPorCurso.set(cursoId, alunos.size);
    for (const alunoId of alunos) todosAlunosInscritos.add(alunoId);
  }
  const totalAlunosInscritos = todosAlunosInscritos.size;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cursos Gratuitos</h1>
          <p className="text-muted-foreground text-sm">
            Cursos oferecidos gratuitamente em plataformas externas.
          </p>
        </div>
        <Button render={<Link href="/admin/cursos-gratuitos/novo" />} nativeButton={false}>
          <Plus />
          Novo Curso Gratuito
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">Total de Cursos Gratuitos</p>
            <p className="text-2xl font-semibold">{cursos?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">Total de Alunos Inscritos</p>
            <p className="text-2xl font-semibold">{totalAlunosInscritos}</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar os cursos gratuitos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !cursos || cursos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum curso gratuito cadastrado ainda.</p>
            <Button render={<Link href="/admin/cursos-gratuitos/novo" />} nativeButton={false} variant="outline">
              <Plus />
              Cadastrar primeiro curso gratuito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <CursosGratuitosTable
            cursos={cursos.map((curso) => ({ ...curso, inscritos: inscritosPorCurso.get(curso.id) ?? 0 }))}
          />
        </Card>
      )}
    </div>
  );
}
