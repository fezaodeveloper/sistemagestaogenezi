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
  // turmas desse curso (qualquer status — uma matrícula pode estar numa turma já encerrada);
  // sem curso, só as turmas ativas (mesmo critério do resto do admin, ex. dashboard comercial).
  const [{ data: cursosOpcoes }, { data: turmasOpcoes }] = await Promise.all([
    supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome"),
    cursoIdFiltro
      ? supabase.from("turmas").select("id, nome").eq("curso_id", cursoIdFiltro).order("nome")
      : supabase.from("turmas").select("id, nome").eq("status", "ativa").order("nome"),
  ]);

  let query = supabase
    .from("matriculas")
    .select(
      "*, alunos(full_name, email, cpf), turmas(nome, vagas_total, vagas_ocupadas, cursos(nome), turma_cursos(curso_id, ordem, cursos(nome))), contratos_assinados(status, aceito_em)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  // matriculas não tem curso_id próprio (só turma_id) — o curso só existe via turmas.curso_id,
  // por isso o filtro por curso precisa achar as turmas desse curso primeiro (mesmo padrão já
  // usado abaixo pra busca por nome de curso). turma_id, quando presente, já é mais específico
  // que curso_id e dispensa essa segunda consulta.
  if (turmaIdFiltro) {
    query = query.eq("turma_id", turmaIdFiltro);
  } else if (cursoIdFiltro) {
    const { data: turmasDoCurso } = await supabase.from("turmas").select("id").eq("curso_id", cursoIdFiltro);
    const idsTurmasDoCurso = (turmasDoCurso ?? []).map((turma) => turma.id as string);
    query = idsTurmasDoCurso.length > 0 ? query.in("turma_id", idsTurmasDoCurso) : query.eq("id", ID_INEXISTENTE);
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
      const { data: turmasEncontradas } = await supabase
        .from("turmas")
        .select("id")
        .in("curso_id", idsCursos)
        .limit(LIMITE_IDS_BUSCA);
      idsTurmas = (turmasEncontradas ?? []).map((turma) => turma.id as string);
      if (idsTurmas.length >= LIMITE_IDS_BUSCA) buscaTruncada = true;
    }
    if (idsAlunos.length >= LIMITE_IDS_BUSCA || idsCursos.length >= LIMITE_IDS_BUSCA) buscaTruncada = true;

    const condicoes: string[] = [];
    if (idsAlunos.length > 0) condicoes.push(`aluno_id.in.(${idsAlunos.join(",")})`);
    if (idsTurmas.length > 0) condicoes.push(`turma_id.in.(${idsTurmas.join(",")})`);
    // Nenhum aluno/curso bate com o termo: força resultado vazio.
    query = condicoes.length > 0 ? query.or(condicoes.join(",")) : query.eq("id", ID_INEXISTENTE);
  }

  const { data, error, count } = await query.range(offset, offset + limite - 1);
  const matriculas = data as MatriculaListItem[] | null;
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
          />
        </Card>
      )}
    </div>
  );
}
