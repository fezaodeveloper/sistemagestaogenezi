import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { MATRICULA_STATUSES } from "@/lib/matriculas/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CursoTipo = (typeof CURSO_TIPOS)[number];

type MatriculaCursoRow = {
  status: (typeof MATRICULA_STATUSES)[number];
  turmas: { cursos: { id: string; nome: string; tipo: CursoTipo } | null } | null;
};

type CursoAluno = { id: string; nome: string; tipo: CursoTipo; emAndamento: boolean };

// Um card por curso, não por matrícula/turma — o aluno pode ter mais de uma
// matrícula no mesmo curso (turmas diferentes), mas o conteúdo é o mesmo.
// Se qualquer matrícula naquele curso estiver "ativa", o curso conta como em
// andamento; só aparece como concluído se todas forem "concluida".
function agruparPorCurso(rows: MatriculaCursoRow[]): CursoAluno[] {
  const mapa = new Map<string, CursoAluno>();

  for (const row of rows) {
    const curso = row.turmas?.cursos;
    if (!curso) continue;

    const emAndamento = row.status === "ativa";
    const atual = mapa.get(curso.id);

    if (!atual) {
      mapa.set(curso.id, { id: curso.id, nome: curso.nome, tipo: curso.tipo, emAndamento });
    } else if (emAndamento) {
      atual.emAndamento = true;
    }
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export default async function AlunoDashboardPage() {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("status, turmas(cursos(id, nome, tipo))")
    .eq("aluno_id", user.id)
    .in("status", ["ativa", "concluida"]);

  const cursos = data ? agruparPorCurso(data as unknown as MatriculaCursoRow[]) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus Cursos</h1>
        <p className="text-muted-foreground text-sm">Bem-vindo, {user.full_name ?? user.email}.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar seus cursos. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !cursos || cursos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Você ainda não está matriculado em nenhum curso.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((curso) => (
            <Link key={curso.id} href={`/aluno/cursos/${curso.id}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <CardTitle>{curso.nome}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{CURSO_TIPO_LABELS[curso.tipo]}</Badge>
                  <Badge variant={curso.emAndamento ? "default" : "outline"}>
                    {curso.emAndamento ? "Em andamento" : "Concluído"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
