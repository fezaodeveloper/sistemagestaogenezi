import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { parseBusca, termoIlike } from "@/lib/busca";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatriculasTable, type MatriculaListItem } from "@/components/admin/matriculas-table";

const LIMITE_IDS_BUSCA = 100;
const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; curso_id?: string; turma_id?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, q: qRaw, curso_id: cursoId, turma_id: turmaId } = await searchParams;
  const q = parseBusca(qRaw);
  const UUID_REGEX = /^[0-9a-f-]{36}$/i;
  const cursoIdFiltro = cursoId && UUID_REGEX.test(cursoId) ? cursoId : "";
  const turmaIdFiltro = turmaId && UUID_REGEX.test(turmaId) ? turmaId : "";

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const supabase = await createClient();

  // Opções dos dois selects (PARTE 1). Turma em cascata: com curso selecionado, mostra TODAS as
  // turmas QUE OFERECEM esse curso (via turma_cursos — uma turma pode oferecer 2+ cursos, não só
  // o "principal" de turmas.curso_id), qualquer status (uma matrícula pode estar numa turma já
  // encerrada); sem curso, só as turmas ativas (mesmo critério do resto do admin).
  const [{ data: cursosOpcoes }, { data: turmasOpcoesRaw }] = await Promise.all([
    supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome"),
    cursoIdFiltro
      ? supabase.from("turma_cursos").select("turmas(id, nome)").eq("curso_id", cursoIdFiltro)
      : supabase.from("turmas").select("id, nome").eq("status", "ativa").order("nome"),
  ]);
  // turma_cursos!inner embed devolve { turmas: {id,nome} }[] — achata pro mesmo formato do outro
  // branch ({id,nome}[]), e ordena no client (poucas linhas, não vale outra query ordenada).
  const turmasOpcoes = (
    cursoIdFiltro
      ? ((turmasOpcoesRaw ?? []) as unknown as { turmas: { id: string; nome: string } | null }[])
          .map((v) => v.turmas)
          .filter((t): t is { id: string; nome: string } => !!t)
          .sort((a, b) => a.nome.localeCompare(b.nome))
      : (turmasOpcoesRaw ?? [])
  ) as { id: string; nome: string }[];

  let query = supabase
    .from("matriculas")
    .select(
      "*, alunos(full_name, email, cpf), turmas(nome, vagas_total, vagas_ocupadas, cursos(nome), turma_cursos(curso_id, ordem, cursos(nome))), contratos_assinados(status, aceito_em)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  // TAREFA fix cursos por turma — o filtro por curso precisa achar as matrículas desse curso por
  // DOIS caminhos: (a) matriculas.curso_id = cursoIdFiltro (o aluno escolheu esse curso
  // explicitamente — fonte de verdade) OU (b) a matrícula está numa turma que oferece esse curso
  // (turma_cursos, não turmas.curso_id — uma turma pode oferecer 2+ cursos) E curso_id é null
  // (matrícula antiga, compatibilidade legada). turma_id, quando presente, já é mais específico
  // que curso_id e dispensa essa segunda consulta.
  if (turmaIdFiltro) {
    query = query.eq("turma_id", turmaIdFiltro);
  } else if (cursoIdFiltro) {
    const { data: turmasDoCurso } = await supabase.from("turma_cursos").select("turma_id").eq("curso_id", cursoIdFiltro);
    const idsTurmasDoCurso = (turmasDoCurso ?? []).map((v) => v.turma_id as string);
    const condicoes: string[] = [`curso_id.eq.${cursoIdFiltro}`];
    if (idsTurmasDoCurso.length > 0) {
      condicoes.push(`and(curso_id.is.null,turma_id.in.(${idsTurmasDoCurso.join(",")}))`);
    }
    query = query.or(condicoes.join(","));
  }

  // Busca por aluno OU curso, sobre todas as matrículas (não só a página).
  // Nome do aluno mora em profiles (alunos.id = profiles.id) e o curso está
  // dois embeds abaixo (turmas -> cursos) — um filtro `or` não alcança colunas
  // de tabela embutida, então acha os ids primeiro e filtra por aluno_id /
  // turma_id. Cada lista de ids vai na URL da requisição, por isso o teto de
  // LIMITE_IDS_BUSCA (com aviso na tela quando estoura).
  let buscaTruncada = false;
  if (q) {
    const termo = termoIlike(q);
    const [{ data: perfis }, { data: cursosEncontrados }] = await Promise.all([
      supabase.from("profiles").select("id").ilike("full_name", `%${termo}%`).limit(LIMITE_IDS_BUSCA),
      supabase.from("cursos").select("id").ilike("nome", `%${termo}%`).limit(LIMITE_IDS_BUSCA),
    ]);
    const idsAlunos = (perfis ?? []).map((perfil) => perfil.id as string);
    const idsCursos = (cursosEncontrados ?? []).map((curso) => curso.id as string);

    let idsTurmas: string[] = [];
    if (idsCursos.length > 0) {
      // TAREFA fix cursos por turma — turma_cursos (não turmas.curso_id), pra achar TODAS as
      // turmas que oferecem algum dos cursos encontrados, não só onde é o "principal".
      const { data: turmasEncontradas } = await supabase
        .from("turma_cursos")
        .select("turma_id")
        .in("curso_id", idsCursos)
        .limit(LIMITE_IDS_BUSCA);
      idsTurmas = [...new Set((turmasEncontradas ?? []).map((v) => v.turma_id as string))];
      if (idsTurmas.length >= LIMITE_IDS_BUSCA) buscaTruncada = true;
    }
    if (idsAlunos.length >= LIMITE_IDS_BUSCA || idsCursos.length >= LIMITE_IDS_BUSCA) buscaTruncada = true;

    const condicoes: string[] = [];
    if (idsAlunos.length > 0) condicoes.push(`aluno_id.in.(${idsAlunos.join(",")})`);
    if (idsTurmas.length > 0) condicoes.push(`turma_id.in.(${idsTurmas.join(",")})`);
    if (idsCursos.length > 0) condicoes.push(`curso_id.in.(${idsCursos.join(",")})`);
    // Nenhum aluno/curso bate com o termo: força resultado vazio.
    query = condicoes.length > 0 ? query.or(condicoes.join(",")) : query.eq("id", ID_INEXISTENTE);
  }

  const { data, error, count } = await query.range(offset, offset + limite - 1);
  const matriculas = data as MatriculaListItem[] | null;

  // TAREFA fix cursos por turma — resolve em lote o NOME do curso que cada aluno desta página
  // escolheu (matriculas.curso_id). Consulta separada, não embed: matriculas tem duas FKs pra
  // cursos (curso_id e curso_bonus_id), mesmo motivo documentado em src/app/aluno/page.tsx.
  const idsCursosEscolhidos = [...new Set((matriculas ?? []).map((m) => m.curso_id).filter((id): id is string => !!id))];
  const { data: cursosEscolhidosData } =
    idsCursosEscolhidos.length > 0
      ? await supabase.from("cursos").select("id, nome").in("id", idsCursosEscolhidos)
      : { data: [] };
  const nomesCursosEscolhidos = Object.fromEntries((cursosEscolhidosData ?? []).map((c) => [c.id as string, c.nome as string]));

  const totalRegistros = count ?? 0;
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Matrículas</h1>
        <p className="text-muted-foreground text-sm">Gerencie as matrículas dos alunos.</p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as matrículas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : !matriculas || (totalRegistros === 0 && !q && !cursoIdFiltro && !turmaIdFiltro) ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma matrícula cadastrada ainda.</p>
            <Button
              render={<Link href="/admin/matriculas/nova" />}
              nativeButton={false}
              variant="outline"
            >
              <Plus />
              Nova matrícula
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <MatriculasTable
            matriculas={matriculas}
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            limite={limite}
            q={q}
            buscaTruncada={buscaTruncada}
            cursos={cursosOpcoes ?? []}
            turmas={turmasOpcoes ?? []}
            cursoIdFiltro={cursoIdFiltro}
            turmaIdFiltro={turmaIdFiltro}
            nomesCursosEscolhidos={nomesCursosEscolhidos}
          />
        </Card>
      )}
    </div>
  );
}
