import Link from "next/link";
import { Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCursoProgresso, type CursoProgresso } from "@/lib/aulas-concluidas/progresso";
import { getMeusPontos } from "@/lib/gamificacao/ranking";
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { MATRICULA_STATUSES } from "@/lib/matriculas/schema";
import { isAvatarId } from "@/lib/avatares/catalog";
import { AlunoAvatar } from "@/components/gamificacao/aluno-avatar";
import { Capa } from "@/components/aluno/capa";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CursoTipo = (typeof CURSO_TIPOS)[number];

type MatriculaCursoRow = {
  status: (typeof MATRICULA_STATUSES)[number];
  data_expiracao: string;
  turmas: { cursos: { id: string; nome: string; tipo: CursoTipo; capa_url: string | null } | null } | null;
};

type CursoAluno = {
  id: string;
  nome: string;
  tipo: CursoTipo;
  capaUrl: string | null;
  emAndamento: boolean;
  dataExpiracao: string;
  expirada: boolean;
};

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Um card por curso, não por matrícula/turma — o aluno pode ter mais de uma
// matrícula no mesmo curso (turmas diferentes), mas o conteúdo é o mesmo.
// Se qualquer matrícula naquele curso estiver "ativa", o curso conta como em
// andamento; só aparece como concluído se todas forem "concluida". Já a
// expiração usa só a matrícula mais recente (linhas vêm ordenadas por
// created_at desc) — mesmo critério de desempate de getMatriculaIdAtivaParaCurso
// em todo o resto do sistema, pra o badge aqui bater com o que a página do
// curso mostra ao clicar. Comparação de data em JS, não via RPC
// (matricula_expirada): é só um badge informativo, não fronteira de
// acesso — a página do curso, essa sim, usa a function SQL.
function agruparPorCurso(rows: MatriculaCursoRow[]): CursoAluno[] {
  const hoje = new Date().toISOString().slice(0, 10);
  const mapa = new Map<string, CursoAluno>();

  for (const row of rows) {
    const curso = row.turmas?.cursos;
    if (!curso) continue;

    const emAndamento = row.status === "ativa";
    const atual = mapa.get(curso.id);

    if (!atual) {
      mapa.set(curso.id, {
        id: curso.id,
        nome: curso.nome,
        tipo: curso.tipo,
        capaUrl: curso.capa_url,
        emAndamento,
        dataExpiracao: row.data_expiracao,
        expirada: row.data_expiracao < hoje,
      });
    } else if (emAndamento) {
      atual.emAndamento = true;
    }
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export default async function AlunoDashboardPage() {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const [{ data, error }, meusPontos] = await Promise.all([
    supabase
      .from("matriculas")
      .select("status, data_expiracao, turmas(cursos(id, nome, tipo, capa_url))")
      .eq("aluno_id", user.id)
      .in("status", ["ativa", "concluida"])
      .order("created_at", { ascending: false }),
    getMeusPontos(supabase, user.id),
  ]);

  const cursosBrutos = data ? agruparPorCurso(data as unknown as MatriculaCursoRow[]) : null;

  // Capa fica em bucket público — a URL é montada aqui (não precisa de
  // signed URL, mesma lógica já usada pra foto de prêmio).
  const cursos = cursosBrutos?.map((curso) => ({
    ...curso,
    capaUrl: curso.capaUrl ? supabase.storage.from("cursos").getPublicUrl(curso.capaUrl).data.publicUrl : null,
  }));

  const progressos: Record<string, CursoProgresso> = {};
  if (cursos && cursos.length > 0) {
    const resultados = await Promise.all(
      cursos.map((curso) => getCursoProgresso(supabase, curso.id)),
    );
    cursos.forEach((curso, i) => {
      progressos[curso.id] = resultados[i];
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlunoAvatar avatarId={isAvatarId(user.avatar_id) ? user.avatar_id : "raposa"} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">Meus Cursos</h1>
            <p className="text-muted-foreground text-sm">
              Bem-vindo, {user.full_name ?? user.email}.
            </p>
          </div>
        </div>
        <Link
          href="/aluno/ranking"
          className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
        >
          <Trophy className="text-muted-foreground size-4" />
          <span>
            Seus pontos: <span className="font-semibold">{meusPontos}</span>
          </span>
        </Link>
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cursos.map((curso) => {
            const progresso = progressos[curso.id];
            const percentual =
              progresso && progresso.total > 0
                ? Math.round((progresso.concluidas / progresso.total) * 100)
                : 0;

            return (
              <Link key={curso.id} href={`/aluno/cursos/${curso.id}`}>
                <Card className="group hover:bg-accent/50 hover:shadow-lg hover:shadow-foreground/10 gap-0 overflow-hidden py-0 transition duration-300">
                  <Capa
                    capaUrl={curso.capaUrl}
                    nome={curso.nome}
                    className="w-full rounded-none transition-transform duration-300 ease-out group-hover:scale-105"
                  />
                  <CardContent className="flex flex-col gap-2 p-3">
                    <h3 className="line-clamp-2 text-sm font-medium">{curso.nome}</h3>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {CURSO_TIPO_LABELS[curso.tipo]}
                      </Badge>
                      {curso.expirada ? (
                        <Badge variant="destructive" className="text-xs">
                          Expirado
                        </Badge>
                      ) : (
                        <Badge variant={curso.emAndamento ? "default" : "outline"} className="text-xs">
                          {curso.emAndamento ? "Em andamento" : "Concluído"}
                        </Badge>
                      )}
                    </div>
                    {curso.expirada && (
                      <p className="text-destructive text-xs">
                        Acesso expirado em {formatDateBR(curso.dataExpiracao)}
                      </p>
                    )}
                    {progresso && progresso.total > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={percentual} className="flex-1" />
                        <span className="text-muted-foreground text-xs">
                          {progresso.concluidas}/{progresso.total}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
